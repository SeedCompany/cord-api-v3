import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import {
  type ID,
  type ObjectView,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { HandleIdLookup } from '~/core/resources';
import { Privileges } from '../authorization';
import { CeremonyChannels } from './ceremony.channels';
import { CeremonyRepository } from './ceremony.repository';
import {
  Ceremony,
  CeremonyUpdate,
  type CreateCeremony,
  type UpdateCeremony,
} from './dto';

@Injectable()
export class CeremonyService {
  constructor(
    private readonly privileges: Privileges,
    private readonly channels: CeremonyChannels,
    private readonly repo: CeremonyRepository,
  ) {}

  async create(input: CreateCeremony): Promise<ID> {
    const { id } = await this.repo.create(input);

    this.channels.publishToAll('created', {
      ceremony: id,
      at: DateTime.now(),
    });

    return id;
  }

  @HandleIdLookup(Ceremony)
  async readOne(id: ID, _view?: ObjectView): Promise<Ceremony> {
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

  async update(input: UpdateCeremony) {
    const object = await this.repo.readOne(input.id);
    const changes = this.repo.getActualChanges(object, input);

    if (Object.keys(changes).length === 0) {
      return { ceremony: this.secure(object) };
    }

    this.privileges.for(Ceremony, object).verifyChanges(changes);
    const updated = await this.repo.update({
      id: input.id,
      ...changes,
    });

    const payload = this.channels.publishToAll('updated', {
      ceremony: updated.id,
      at: DateTime.now(),
      updated: CeremonyUpdate.fromInput(changes),
      previous: CeremonyUpdate.pickPrevious(object, changes),
    });

    return { ceremony: this.secure(updated), payload };
  }

  async delete(id: ID): Promise<void> {
    const object = await this.repo.readOne(id);

    // Only called internally, not exposed directly to users
    // this.privileges.for( Ceremony, object).verifyCan('delete');

    const { at } = await this.repo.deleteNode(object).catch((exception) => {
      throw new ServerException('Failed to delete Ceremony', exception);
    });

    this.channels.publishToAll('deleted', {
      ceremony: id,
      at,
    });
  }
}
