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
import { type ProjectListInput, type SecuredProjectList } from '../project/dto';
import { ProjectService } from '../project/project.service';
import { UserService } from '../user';
import {
  type CreateFieldZone,
  FieldZone,
  type FieldZoneListInput,
  type FieldZoneListOutput,
  type UpdateFieldZone,
} from './dto';
import { FieldZoneUpdatedEvent } from './events/field-zone-updated.event';
import { FieldZoneRepository } from './field-zone.repository';

@Injectable()
export class FieldZoneService {
  constructor(
    private readonly privileges: Privileges,
    private readonly events: IEventBus,
    private readonly users: UserService,
    private readonly repo: FieldZoneRepository,
    private readonly projectService: ProjectService,
  ) {}

  async create(input: CreateFieldZone): Promise<FieldZone> {
    this.privileges.for(FieldZone).verifyCan('create');
    await this.validateDirectorRole(input.directorId);
    const dto = await this.repo.create(input);
    return this.secure(dto);
  }

  @HandleIdLookup(FieldZone)
  async readOne(id: ID, _view?: ObjectView): Promise<FieldZone> {
    const result = await this.repo.readOne(id);
    return this.secure(result);
  }

  async readMany(ids: readonly ID[]) {
    const fieldZones = await this.repo.readMany(ids);
    return fieldZones.map((dto) => this.secure(dto));
  }

  private secure(dto: UnsecuredDto<FieldZone>) {
    return this.privileges.for(FieldZone).secure(dto);
  }

  async update(input: UpdateFieldZone): Promise<FieldZone> {
    const fieldZone = await this.repo.readOne(input.id);

    const changes = this.repo.getActualChanges(fieldZone, input);
    this.privileges.for(FieldZone, fieldZone).verifyChanges(changes);

    if (changes.directorId) {
      await this.validateDirectorRole(changes.directorId);
    }

    if (Object.keys(changes).length === 0) {
      return this.secure(fieldZone);
    }

    const updated = await this.repo.update({ id: input.id, ...changes });

    const event = new FieldZoneUpdatedEvent(fieldZone, updated, {
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
        throw e.withField('fieldZone.directorId');
      }
      throw e;
    }
    if (!director.roles.includes('FieldOperationsDirector')) {
      throw new InputException(
        'User does not have the Field Operations Director role',
        'fieldZone.directorId',
      );
    }
    return director;
  }

  async delete(id: ID): Promise<void> {
    const object = await this.readOne(id);

    this.privileges.for(FieldZone, object).verifyCan('delete');

    try {
      await this.repo.deleteNode(object);
    } catch (exception) {
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(input: FieldZoneListInput): Promise<FieldZoneListOutput> {
    const results = await this.repo.list(input);
    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto)),
    };
  }

  async listProjects(
    fieldZone: FieldZone,
    input: ProjectListInput,
  ): Promise<SecuredProjectList> {
    const projectListOutput = await this.projectService.list({
      ...input,
      filter: {
        ...input.filter,
        fieldRegion: {
          ...(input.filter?.fieldRegion ?? {}),
          fieldZone: {
            ...(input.filter?.fieldRegion?.fieldZone ?? {}),
            id: fieldZone.id,
          },
        },
      },
    });

    return {
      ...projectListOutput,
      canRead: true,
      canCreate: false, // Field zone doesn't own project creation
    };
  }
}
