import { Injectable } from '@nestjs/common';
import { type ID, type ObjectView, type UnsecuredDto } from '~/common';
import { Identity } from '~/core/authentication';
import { Hooks } from '~/core/hooks';
import { HandleIdLookup } from '~/core/resources';
import { ResourceMutatedHook } from '../../audit/resource-mutated.hook';
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
    private readonly hooks: Hooks,
  ) {}

  async create(input: CreateUnavailability): Promise<Unavailability> {
    this.privileges.for(Unavailability).verifyCan('create');
    const result = await this.repo.create(input);
    await this.hooks.run(
      new ResourceMutatedHook('Unavailability', result.id, 'Create'),
    );
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
    const result = await this.repo.getUserByUnavailabilityId(input.id);
    const changes = this.repo.getActualChanges(unavailability, input);
    // TODO move this condition into policies
    if (!this.identity.isSelf(result.id)) {
      this.privileges
        .for(Unavailability, unavailability)
        .verifyChanges(changes);
    }
    const updated = await this.repo.update({ id: input.id, ...changes });
    await this.hooks.run(
      new ResourceMutatedHook('Unavailability', input.id, 'Update', changes),
    );
    return this.secure(updated);
  }

  async delete(id: ID): Promise<void> {
    await this.repo.readOne(id);
    await this.repo.delete(id);
    await this.hooks.run(
      new ResourceMutatedHook('Unavailability', id, 'Delete'),
    );
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
