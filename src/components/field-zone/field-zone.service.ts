import { Injectable } from '@nestjs/common';
import {
  type ID,
  type ObjectView,
  ServerException,
  type Session,
  type UnsecuredDto,
} from '~/common';
import { HandleIdLookup } from '~/core';
import { Privileges } from '../authorization';
import {
  type CreateFieldZone,
  FieldZone,
  type FieldZoneListInput,
  type FieldZoneListOutput,
  type UpdateFieldZone,
} from './dto';
import { FieldZoneRepository } from './field-zone.repository';

@Injectable()
export class FieldZoneService {
  constructor(
    private readonly privileges: Privileges,
    private readonly repo: FieldZoneRepository,
  ) {}

  async create(input: CreateFieldZone, session: Session): Promise<FieldZone> {
    this.privileges.for(FieldZone).verifyCan('create');
    const dto = await this.repo.create(input);
    return this.secure(dto, session);
  }

  @HandleIdLookup(FieldZone)
  async readOne(
    id: ID,
    session: Session,
    _view?: ObjectView,
  ): Promise<FieldZone> {
    const result = await this.repo.readOne(id);
    return this.secure(result, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const fieldZones = await this.repo.readMany(ids);
    return fieldZones.map((dto) => this.secure(dto, session));
  }

  private secure(dto: UnsecuredDto<FieldZone>, session: Session) {
    return this.privileges.for(FieldZone).secure(dto);
  }

  async update(input: UpdateFieldZone, session: Session): Promise<FieldZone> {
    const fieldZone = await this.repo.readOne(input.id);

    const changes = this.repo.getActualChanges(fieldZone, input);
    this.privileges.for(FieldZone, fieldZone).verifyChanges(changes);

    const updated = await this.repo.update({ id: input.id, ...changes });
    return this.secure(updated, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    this.privileges.for(FieldZone, object).verifyCan('delete');

    try {
      await this.repo.deleteNode(object);
    } catch (exception) {
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(
    input: FieldZoneListInput,
    session: Session,
  ): Promise<FieldZoneListOutput> {
    const results = await this.repo.list(input, session);
    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto, session)),
    };
  }
}
