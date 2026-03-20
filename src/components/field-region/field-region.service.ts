import { Injectable } from '@nestjs/common';
import {
  type ID,
  InputException,
  NotFoundException,
  type ObjectView,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { Hooks } from '~/core/hooks';
import { HandleIdLookup } from '~/core/resources';
import { Privileges } from '../authorization';
import {
  IProject,
  type ProjectListInput,
  type SecuredProjectList,
} from '../project/dto';
import { ProjectService } from '../project/project.service';
import { UserService } from '../user';
import {
  type CreateFieldRegion,
  FieldRegion,
  type FieldRegionListInput,
  type FieldRegionListOutput,
  type UpdateFieldRegion,
} from './dto';
import { FieldRegionRepository } from './field-region.repository';
import { FieldRegionUpdatedHook } from './hooks/field-region-updated.hook';

@Injectable()
export class FieldRegionService {
  constructor(
    private readonly privileges: Privileges,
    private readonly hooks: Hooks,
    private readonly users: UserService,
    private readonly repo: FieldRegionRepository,
    private readonly projectService: ProjectService,
  ) {}

  async create(input: CreateFieldRegion): Promise<FieldRegion> {
    this.privileges.for(FieldRegion).verifyCan('create');
    await this.validateDirectorRole(input.director);
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

    if (changes.director) {
      await this.validateDirectorRole(changes.director);
    }

    if (Object.keys(changes).length === 0) {
      return this.secure(fieldRegion);
    }

    const updated = await this.repo.update({ id: input.id, ...changes });

    const event = new FieldRegionUpdatedHook(fieldRegion, updated, {
      id: input.id,
      ...changes,
    });
    await this.hooks.run(event);

    return this.secure(updated);
  }

  private async validateDirectorRole(directorId: ID<'User'>) {
    let director;
    try {
      director = await this.users.readOneUnsecured(directorId);
    } catch (e) {
      if (e instanceof NotFoundException) {
        throw e.withField('director');
      }
      throw e;
    }
    if (!director.roles.includes('RegionalDirector')) {
      throw new InputException(
        'User does not have the Regional Director role',
        'director',
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

  async listProjects(
    fieldRegion: FieldRegion,
    input: ProjectListInput,
  ): Promise<SecuredProjectList> {
    const projectListOutput = await this.projectService.list({
      ...input,
      filter: {
        ...input.filter,
        fieldRegion: {
          ...(input.filter?.fieldRegion ?? {}),
          id: fieldRegion.id,
        },
      },
    });

    return {
      ...projectListOutput,
      canRead: true,
      canCreate: this.privileges.for(IProject).can('create'),
    };
  }
}
