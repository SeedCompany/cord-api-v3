import { Injectable } from '@nestjs/common';
import {
  type ID,
  InputException,
  type ObjectView,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { HandleIdLookup } from '~/core';
import { Privileges } from '../authorization';
import { CeremonyRepository } from './ceremony.repository';
import { Ceremony, type CreateCeremony, type UpdateCeremony } from './dto';

@Injectable()
export class CeremonyService {
  constructor(
    private readonly privileges: Privileges,
    private readonly repo: CeremonyRepository,
  ) {}

  async create(input: CreateCeremony): Promise<ID> {
    const { id } = await this.repo.create(input);

    return id;
  }

  @HandleIdLookup(Ceremony)
  async readOne(id: ID, _view?: ObjectView): Promise<Ceremony> {
    if (!id) {
      throw new InputException('No ceremony id to search for', 'ceremony.id');
    }

    const dto = await this.repo.readOne(id);
    return this.secure(dto);
  }

  async readMany(ids: readonly ID[]) {
    const ceremonies = await this.repo.readMany(ids);
    return ceremonies.map((dto) => this.secure(dto));
  }

  secure(dto: UnsecuredDto<Ceremony>) {
    return this.privileges.for(Ceremony).secure(dto);
  }

  async update(input: UpdateCeremony): Promise<Ceremony> {
    const object = await this.repo.readOne(input.id);
    const changes = this.repo.getActualChanges(object, input);
    this.privileges.for(Ceremony, object).verifyChanges(changes);
    const updated = await this.repo.update({
      id: input.id,
      ...changes,
    });
    return this.secure(updated);
  }

  async delete(id: ID): Promise<void> {
    const object = await this.repo.readOne(id);

    // Only called internally, not exposed directly to users
    // this.privileges.for( Ceremony, object).verifyCan('delete');

    try {
      await this.repo.deleteNode(object);
    } catch (exception) {
      throw new ServerException('Failed to delete Ceremony', exception);
    }
  }
}
