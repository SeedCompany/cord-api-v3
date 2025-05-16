import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { type ID, IdArg, ListArg, mapSecuredValue } from '~/common';
import { Loader, type LoaderOf } from '~/core';
import { FieldZoneLoader } from '../field-zone';
import { SecuredFieldZone } from '../field-zone/dto';
import { UserLoader } from '../user';
import { SecuredUser } from '../user/dto';
import {
  CreateFieldRegionInput,
  CreateFieldRegionOutput,
  DeleteFieldRegionOutput,
  FieldRegion,
  FieldRegionListInput,
  FieldRegionListOutput,
  UpdateFieldRegionInput,
  UpdateFieldRegionOutput,
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

  @Mutation(() => CreateFieldRegionOutput, {
    description: 'Create a field region',
  })
  async createFieldRegion(
    @Args('input') { fieldRegion: input }: CreateFieldRegionInput,
  ): Promise<CreateFieldRegionOutput> {
    const fieldRegion = await this.fieldRegionService.create(input);
    return { fieldRegion };
  }

  @Mutation(() => UpdateFieldRegionOutput, {
    description: 'Update a field region',
  })
  async updateFieldRegion(
    @Args('input') { fieldRegion: input }: UpdateFieldRegionInput,
  ): Promise<UpdateFieldRegionOutput> {
    const fieldRegion = await this.fieldRegionService.update(input);
    return { fieldRegion };
  }

  @Mutation(() => DeleteFieldRegionOutput, {
    description: 'Delete a field region',
  })
  async deleteFieldRegion(@IdArg() id: ID): Promise<DeleteFieldRegionOutput> {
    await this.fieldRegionService.delete(id);
    return { success: true };
  }
}
