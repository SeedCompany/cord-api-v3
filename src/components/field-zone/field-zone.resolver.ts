import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { type ID, IdArg, ListArg, mapSecuredValue } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { ProjectListInput, SecuredProjectList } from '../project/dto';
import { ProjectLoader } from '../project/project.loader';
import { UserLoader } from '../user';
import { SecuredUser } from '../user/dto';
import {
  CreateFieldZone,
  FieldZone,
  FieldZoneCreated,
  FieldZoneDeleted,
  FieldZoneListInput,
  FieldZoneListOutput,
  FieldZoneUpdated,
  UpdateFieldZone,
} from './dto';
import { FieldZoneLoader } from './field-zone.loader';
import { FieldZoneService } from './field-zone.service';

@Resolver(FieldZone)
export class FieldZoneResolver {
  constructor(private readonly fieldZoneService: FieldZoneService) {}

  @Query(() => FieldZone, {
    description: 'Read one field zone by id',
  })
  async fieldZone(
    @Loader(FieldZoneLoader) fieldZones: LoaderOf<FieldZoneLoader>,
    @IdArg() id: ID,
  ): Promise<FieldZone> {
    return await fieldZones.load(id);
  }

  @Query(() => FieldZoneListOutput, {
    description: 'Look up field zones',
  })
  async fieldZones(
    @ListArg(FieldZoneListInput) input: FieldZoneListInput,
    @Loader(FieldZoneLoader) fieldZones: LoaderOf<FieldZoneLoader>,
  ): Promise<FieldZoneListOutput> {
    const list = await this.fieldZoneService.list(input);
    fieldZones.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredUser)
  async director(
    @Parent() fieldZone: FieldZone,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ): Promise<SecuredUser> {
    return await mapSecuredValue(fieldZone.director, ({ id }) =>
      users.load(id),
    );
  }

  @ResolveField(() => SecuredProjectList, {
    description: 'The list of projects in this field zone.',
  })
  async projects(
    @Parent() fieldZone: FieldZone,
    @ListArg(ProjectListInput) input: ProjectListInput,
    @Loader(ProjectLoader) loader: LoaderOf<ProjectLoader>,
  ): Promise<SecuredProjectList> {
    const list = await this.fieldZoneService.listProjects(fieldZone, input);
    loader.primeAll(list.items);
    return list;
  }

  @Mutation(() => FieldZoneCreated, {
    description: 'Create a field zone',
  })
  async createFieldZone(
    @Args('input') input: CreateFieldZone,
  ): Promise<FieldZoneCreated> {
    const fieldZone = await this.fieldZoneService.create(input);
    return { fieldZone };
  }

  @Mutation(() => FieldZoneUpdated, {
    description: 'Update a field zone',
  })
  async updateFieldZone(
    @Args('input') input: UpdateFieldZone,
  ): Promise<FieldZoneUpdated> {
    const fieldZone = await this.fieldZoneService.update(input);
    return { fieldZone };
  }

  @Mutation(() => FieldZoneDeleted, {
    description: 'Delete a field zone',
  })
  async deleteFieldZone(@IdArg() id: ID): Promise<FieldZoneDeleted> {
    await this.fieldZoneService.delete(id);
    return {};
  }
}
