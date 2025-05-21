import { Injectable } from '@nestjs/common';
import {
  type ID,
  InputException,
  NotFoundException,
  type ObjectView,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { HandleIdLookup } from '~/core';
import { IEventBus } from '~/core/events';
import { Privileges } from '../authorization';
import { UserService } from '../user';
import {
  type CreateFieldRegion,
  FieldRegion,
  type FieldRegionListInput,
  type FieldRegionListOutput,
  type UpdateFieldRegion,
} from './dto';
import { FieldRegionUpdatedEvent } from './events/field-region-updated.event';
import { FieldRegionRepository } from './field-region.repository';

@Injectable()
export class FieldRegionService {
  constructor(
    private readonly privileges: Privileges,
    private readonly events: IEventBus,
    private readonly users: UserService,
    private readonly repo: FieldRegionRepository,
  ) {}

  async create(input: CreateFieldRegion): Promise<FieldRegion> {
    this.privileges.for(FieldRegion).verifyCan('create');
    await this.validateDirectorRole(input.directorId);
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

    if (changes.directorId) {
      await this.validateDirectorRole(changes.directorId);
    }

    if (Object.keys(changes).length === 0) {
      return this.secure(fieldRegion);
    }

    const updated = await this.repo.update({ id: input.id, ...changes });

    const event = new FieldRegionUpdatedEvent(fieldRegion, updated, {
      id: input.id,
      ...changes,
    });
    await this.events.publish(event);

    return this.secure(updated);
  }

  private async validateDirectorRole(directorId: ID<'User'>) {
    let director;
    try {
      director = await this.users.readOneUnsecured(directorId);
    } catch (e) {
      if (e instanceof NotFoundException) {
        throw e.withField('fieldRegion.directorId');
      }
      throw e;
    }
    if (!director.roles.includes('RegionalDirector')) {
      throw new InputException(
        'User does not have the Regional Director role',
        'fieldRegion.directorId',
      );
    }
    return director;
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
