import { Injectable } from '@nestjs/common';
import { type ID, type ObjectView, type UnsecuredDto } from '~/common';
import { HandleIdLookup } from '~/core';
import { Identity } from '~/core/authentication';
import { Privileges } from '../../authorization';
import {
  type CreateUnavailability,
  Unavailability,
  type UnavailabilityListInput,
  type UnavailabilityListOutput,
  type UpdateUnavailability,
} from './dto';
import { UnavailabilityRepository } from './unavailability.repository';

@Injectable()
export class UnavailabilityService {
  constructor(
    private readonly privileges: Privileges,
    private readonly identity: Identity,
    private readonly repo: UnavailabilityRepository,
  ) {}

  async create(input: CreateUnavailability): Promise<Unavailability> {
    this.privileges.for(Unavailability).verifyCan('create');
    const result = await this.repo.create(input);
    return this.secure(result);
  }

  @HandleIdLookup(Unavailability)
  async readOne(id: ID, _view?: ObjectView): Promise<Unavailability> {
    const result = await this.repo.readOne(id);
    return this.secure(result);
  }

  async readMany(ids: readonly ID[]) {
    const unavailabilities = await this.repo.readMany(ids);
    return unavailabilities.map((dto) => this.secure(dto));
  }

  private secure(dto: UnsecuredDto<Unavailability>) {
    return this.privileges.for(Unavailability).secure(dto);
  }

  async update(input: UpdateUnavailability): Promise<Unavailability> {
    const unavailability = await this.repo.readOne(input.id);
    const result = await this.repo.getUserIdByUnavailability(input.id);
    const changes = this.repo.getActualChanges(unavailability, input);
    // TODO move this condition into policies
    const session = this.identity.current;
    if (result.id !== session.userId) {
      this.privileges
        .for(Unavailability, unavailability)
        .verifyChanges(changes);
    }
    const updated = await this.repo.update({ id: input.id, ...changes });
    return this.secure(updated);
  }

  async delete(id: ID): Promise<void> {
    const ua = await this.repo.readOne(id);
    await this.repo.deleteNode(ua);
  }

  async list(
    input: UnavailabilityListInput,
  ): Promise<UnavailabilityListOutput> {
    const results = await this.repo.list(input);
    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto)),
    };
  }
}
