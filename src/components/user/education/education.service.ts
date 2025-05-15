import { Injectable } from '@nestjs/common';
import {
  type ID,
  type ObjectView,
  type Session,
  type UnsecuredDto,
} from '~/common';
import { HandleIdLookup } from '~/core';
import { SessionHost } from '../../authentication';
import { Privileges } from '../../authorization';
import {
  type CreateEducation,
  Education,
  type EducationListInput,
  type EducationListOutput,
  type UpdateEducation,
} from './dto';
import { EducationRepository } from './education.repository';

@Injectable()
export class EducationService {
  constructor(
    private readonly privileges: Privileges,
    private readonly sessionHost: SessionHost,
    private readonly repo: EducationRepository,
  ) {}

  async create(input: CreateEducation, session: Session): Promise<Education> {
    this.privileges.for(Education).verifyCan('create');
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
    return this.privileges.for(Education).secure(dto);
  }

  async update(input: UpdateEducation, session: Session): Promise<Education> {
    const ed = await this.repo.readOne(input.id);
    const result = await this.repo.getUserIdByEducation(input.id);
    const changes = this.repo.getActualChanges(ed, input);
    // TODO move this condition into policies
    const session = this.sessionHost.current;
    if (result.id !== session.userId) {
      this.privileges.for(Education, ed).verifyChanges(changes);
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
