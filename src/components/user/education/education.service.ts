import { Injectable } from '@nestjs/common';
import { ID, ObjectView, Session, UnsecuredDto } from '~/common';
import { HandleIdLookup, ILogger, Logger } from '~/core';
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
    const result = await this.repo.create(input);
    return this.secure(result, session);
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
    return this.secure(result, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const educations = await this.repo.readMany(ids);
    return await Promise.all(
      educations.map((dto) => this.secure(dto, session)),
    );
  }

  private secure(dto: UnsecuredDto<Education>, session: Session) {
    return this.privileges.for(session, Education).secure(dto);
  }

  async update(input: UpdateEducation, session: Session): Promise<Education> {
    const ed = await this.repo.readOne(input.id);
    const result = await this.repo.getUserIdByEducation(input.id);
    const changes = this.repo.getActualChanges(ed, input);
    // TODO move this condition into policies
    if (result.id !== session.userId) {
      this.privileges.for(session, Education, ed).verifyChanges(changes);
    }

    const updated = await this.repo.update({ id: input.id, ...changes });
    return this.secure(updated, session);
  }

  async delete(_id: ID): Promise<void> {
    // Not Implemented
  }

  async list(
    input: EducationListInput,
    session: Session,
  ): Promise<EducationListOutput> {
    const results = await this.repo.list(input);
    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto, session)),
    };
  }
}
