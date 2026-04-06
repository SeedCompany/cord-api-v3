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
import { FieldZoneLoader } from '../field-zone';
import { SecuredFieldZone } from '../field-zone/dto';
import { ProjectListInput, SecuredProjectList } from '../project/dto';
import { ProjectLoader } from '../project/project.loader';
import { UserLoader } from '../user';
import { SecuredUser } from '../user/dto';
import {
  CreateFieldRegion,
  FieldRegion,
  FieldRegionCreated,
  FieldRegionDeleted,
  FieldRegionListInput,
  FieldRegionListOutput,
  FieldRegionUpdated,
  UpdateFieldRegion,
} from './dto';
import { FieldRegionLoader } from './field-region.loader';
import { FieldRegionService } from './field-region.service';

@Resolver(FieldRegion)
export class FieldRegionResolver {
  constructor(private readonly fieldRegionService: FieldRegionService) {}

  @Query(() => FieldRegion, {
    description: 'Read one field region by id',
  })
  async fieldRegion(
    @Loader(FieldRegionLoader) fieldRegions: LoaderOf<FieldRegionLoader>,
    @IdArg() id: ID,
  ): Promise<FieldRegion> {
    return await fieldRegions.load(id);
  }

  @Query(() => FieldRegionListOutput, {
    description: 'Look up field regions',
  })
  async fieldRegions(
    @ListArg(FieldRegionListInput) input: FieldRegionListInput,
    @Loader(FieldRegionLoader) fieldRegions: LoaderOf<FieldRegionLoader>,
  ): Promise<FieldRegionListOutput> {
    const list = await this.fieldRegionService.list(input);
    fieldRegions.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredUser)
  async director(
    @Parent() fieldRegion: FieldRegion,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ): Promise<SecuredUser> {
    return await mapSecuredValue(fieldRegion.director, ({ id }) =>
      users.load(id),
    );
  }

  @ResolveField(() => SecuredFieldZone)
  async fieldZone(
    @Parent() fieldRegion: FieldRegion,
    @Loader(FieldZoneLoader) fieldZones: LoaderOf<FieldZoneLoader>,
  ): Promise<SecuredFieldZone> {
    return await mapSecuredValue(fieldRegion.fieldZone, ({ id }) =>
      fieldZones.load(id),
    );
  }

  @ResolveField(() => SecuredProjectList, {
    description: 'The list of projects in this field region.',
  })
  async projects(
    @Parent() fieldRegion: FieldRegion,
    @ListArg(ProjectListInput) input: ProjectListInput,
    @Loader(ProjectLoader) loader: LoaderOf<ProjectLoader>,
  ): Promise<SecuredProjectList> {
    const list = await this.fieldRegionService.listProjects(fieldRegion, input);
    loader.primeAll(list.items);
    return list;
  }

  @Mutation(() => FieldRegionCreated, {
    description: 'Create a field region',
  })
  async createFieldRegion(
    @Args('input') input: CreateFieldRegion,
  ): Promise<FieldRegionCreated> {
    const fieldRegion = await this.fieldRegionService.create(input);
    return { fieldRegion };
  }

  @Mutation(() => FieldRegionUpdated, {
    description: 'Update a field region',
  })
  async updateFieldRegion(
    @Args('input') input: UpdateFieldRegion,
  ): Promise<FieldRegionUpdated> {
    const fieldRegion = await this.fieldRegionService.update(input);
    return { fieldRegion };
  }

  @Mutation(() => FieldRegionDeleted, {
    description: 'Delete a field region',
  })
  async deleteFieldRegion(@IdArg() id: ID): Promise<FieldRegionDeleted> {
    await this.fieldRegionService.delete(id);
    return {};
  }
}
