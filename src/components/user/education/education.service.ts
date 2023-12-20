import { Injectable } from '@nestjs/common';
import {
  ID,
  NotFoundException,
  ObjectView,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../../common';
import { HandleIdLookup, ILogger, Logger } from '../../../core';
import { mapListResults } from '../../../core/database/results';
import { Privileges } from '../../authorization';
import {
  CreateEducation,
  Education,
  EducationListInput,
  EducationListOutput,
  UpdateEducation,
} from './dto';
import { EducationRepository } from './education.repository';

@Injectable()
export class EducationService {
  constructor(
    @Logger('education:service') private readonly logger: ILogger,
    private readonly privileges: Privileges,
    private readonly repo: EducationRepository,
  ) {}

  async create(input: CreateEducation, session: Session): Promise<Education> {
    this.privileges.for(session, Education).verifyCan('create');
    // create education
    const result = await this.repo.create(input, session);

    if (!result) {
      throw new ServerException('failed to create education');
    }

    this.logger.debug(`education created`, { id: result.id });
    return await this.readOne(result.id, session);
  }

  @HandleIdLookup(Education)
  async readOne(
    id: ID,
    session: Session,
    _view?: ObjectView,
  ): Promise<Education> {
    this.logger.debug(`Read Education`, {
      id: id,
      userId: session.userId,
    });

    const result = await this.repo.readOne(id);
    return await this.secure(result, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const educations = await this.repo.readMany(ids);
    return await Promise.all(
      educations.map((dto) => this.secure(dto, session)),
    );
  }

  private async secure(
    dto: UnsecuredDto<Education>,
    session: Session,
  ): Promise<Education> {
    return this.privileges.for(session, Education).secure(dto);
  }

  async update(input: UpdateEducation, session: Session): Promise<Education> {
    const ed = await this.readOne(input.id, session);
    const result = await this.repo.getUserIdByEducation(input.id);
    if (!result) {
      throw new NotFoundException(
        'Could not find user associated with education',
        'user.education',
      );
    }
    const changes = this.repo.getActualChanges(ed, input);
    // TODO move this condition into policies
    if (result.id !== session.userId) {
      this.privileges.for(session, Education, ed).verifyChanges(changes);
    }

    await this.repo.update(ed, changes);
    return await this.readOne(input.id, session);
  }

  async delete(_id: ID, _session: Session): Promise<void> {
    // Not Implemented
  }

  async list(
    input: EducationListInput,
    session: Session,
  ): Promise<EducationListOutput> {
    const results = await this.repo.list(input, session);
    return await mapListResults(results, (dto) => this.secure(dto, session));
  }
}
