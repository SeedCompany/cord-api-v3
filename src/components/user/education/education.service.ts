import { Injectable } from '@nestjs/common';
import { type ID, type ObjectView, type UnsecuredDto } from '~/common';
import { HandleIdLookup } from '~/core';
import { Identity } from '~/core/authentication';
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
    private readonly identity: Identity,
    private readonly repo: EducationRepository,
  ) {}

  async create(input: CreateEducation): Promise<Education> {
    this.privileges.for(Education).verifyCan('create');
    // create education
    const result = await this.repo.create(input);
    return this.secure(result);
  }

  @HandleIdLookup(Education)
  async readOne(id: ID, _view?: ObjectView): Promise<Education> {
    const result = await this.repo.readOne(id);
    return this.secure(result);
  }

  async readMany(ids: readonly ID[]) {
    const educations = await this.repo.readMany(ids);
    return await Promise.all(educations.map((dto) => this.secure(dto)));
  }

  private secure(dto: UnsecuredDto<Education>) {
    return this.privileges.for(Education).secure(dto);
  }

  async update(input: UpdateEducation): Promise<Education> {
    const ed = await this.repo.readOne(input.id);
    const result = await this.repo.getUserIdByEducation(input.id);
    const changes = this.repo.getActualChanges(ed, input);
    // TODO move this condition into policies
    if (!this.identity.isSelf(result.id)) {
      this.privileges.for(Education, ed).verifyChanges(changes);
    }

    const updated = await this.repo.update({ id: input.id, ...changes });
    return this.secure(updated);
  }

  async delete(_id: ID): Promise<void> {
    // Not Implemented
  }

  async list(input: EducationListInput): Promise<EducationListOutput> {
    const results = await this.repo.list(input);
    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto)),
    };
  }
}
