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
    private readonly sessionHost: SessionHost,
    private readonly repo: UnavailabilityRepository,
  ) {}

  async create(
    input: CreateUnavailability,
    session: Session,
  ): Promise<Unavailability> {
    this.privileges.for(Unavailability).verifyCan('create');
    const result = await this.repo.create(input);
    return this.secure(result, session);
  }

  @HandleIdLookup(Unavailability)
  async readOne(
    id: ID,
    session: Session,
    _view?: ObjectView,
  ): Promise<Unavailability> {
    const result = await this.repo.readOne(id);
    return this.secure(result, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const unavailabilities = await this.repo.readMany(ids);
    return unavailabilities.map((dto) => this.secure(dto, session));
  }

  private secure(dto: UnsecuredDto<Unavailability>, session: Session) {
    return this.privileges.for(Unavailability).secure(dto);
  }

  async update(
    input: UpdateUnavailability,
    session: Session,
  ): Promise<Unavailability> {
    const unavailability = await this.repo.readOne(input.id);
    const result = await this.repo.getUserIdByUnavailability(input.id);
    const changes = this.repo.getActualChanges(unavailability, input);
    // TODO move this condition into policies
    const session = this.sessionHost.current;
    if (result.id !== session.userId) {
      this.privileges
        .for(Unavailability, unavailability)
        .verifyChanges(changes);
    }
    const updated = await this.repo.update({ id: input.id, ...changes });
    return this.secure(updated, session);
  }

  async delete(id: ID, _session: Session): Promise<void> {
    const ua = await this.repo.readOne(id);
    await this.repo.deleteNode(ua);
  }

  async list(
    input: UnavailabilityListInput,
    session: Session,
  ): Promise<UnavailabilityListOutput> {
    const results = await this.repo.list(input);
    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto, session)),
    };
  }
}
