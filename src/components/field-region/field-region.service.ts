import { Injectable } from '@nestjs/common';
import {
  type ID,
  type ObjectView,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { HandleIdLookup } from '~/core';
import { Privileges } from '../authorization';
import {
  type CreateFieldRegion,
  FieldRegion,
  type FieldRegionListInput,
  type FieldRegionListOutput,
  type UpdateFieldRegion,
} from './dto';
import { FieldRegionRepository } from './field-region.repository';

@Injectable()
export class FieldRegionService {
  constructor(
    private readonly privileges: Privileges,
    private readonly repo: FieldRegionRepository,
  ) {}

  async create(input: CreateFieldRegion): Promise<FieldRegion> {
    this.privileges.for(FieldRegion).verifyCan('create');
    const dto = await this.repo.create(input);
    return this.secure(dto);
  }

  @HandleIdLookup(FieldRegion)
  async readOne(id: ID, _view?: ObjectView): Promise<FieldRegion> {
    const result = await this.repo.readOne(id);
    return this.secure(result);
  }

  async readMany(ids: readonly ID[]) {
    const fieldRegions = await this.repo.readMany(ids);
    return fieldRegions.map((dto) => this.secure(dto));
  }

  private secure(dto: UnsecuredDto<FieldRegion>) {
    return this.privileges.for(FieldRegion).secure(dto);
  }

  async update(input: UpdateFieldRegion): Promise<FieldRegion> {
    const fieldRegion = await this.repo.readOne(input.id);

    const changes = this.repo.getActualChanges(fieldRegion, input);
    this.privileges.for(FieldRegion, fieldRegion).verifyChanges(changes);

    const updated = await this.repo.update({ id: input.id, ...changes });
    return this.secure(updated);
  }

  async delete(id: ID): Promise<void> {
    const object = await this.readOne(id);

    this.privileges.for(FieldRegion, object).verifyCan('delete');

    try {
      await this.repo.deleteNode(object);
    } catch (exception) {
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(input: FieldRegionListInput): Promise<FieldRegionListOutput> {
    const results = await this.repo.list(input);
    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto)),
    };
  }
}
