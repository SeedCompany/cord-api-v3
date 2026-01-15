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
import { UserLoader } from '../user';
import { SecuredUser } from '../user/dto';
import {
  CreateFieldZone,
  CreateFieldZoneOutput,
  DeleteFieldZoneOutput,
  FieldZone,
  FieldZoneListInput,
  FieldZoneListOutput,
  UpdateFieldZone,
  UpdateFieldZoneOutput,
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

  @Mutation(() => CreateFieldZoneOutput, {
    description: 'Create a field zone',
  })
  async createFieldZone(
    @Args('input') input: CreateFieldZone,
  ): Promise<CreateFieldZoneOutput> {
    const fieldZone = await this.fieldZoneService.create(input);
    return { fieldZone };
  }

  @Mutation(() => UpdateFieldZoneOutput, {
    description: 'Update a field zone',
  })
  async updateFieldZone(
    @Args('input') input: UpdateFieldZone,
  ): Promise<UpdateFieldZoneOutput> {
    const fieldZone = await this.fieldZoneService.update(input);
    return { fieldZone };
  }

  @Mutation(() => DeleteFieldZoneOutput, {
    description: 'Delete a field zone',
  })
  async deleteFieldZone(@IdArg() id: ID): Promise<DeleteFieldZoneOutput> {
    await this.fieldZoneService.delete(id);
    return { success: true };
  }
}
