import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  AnonSession,
  ID,
  IdArg,
  LoggedInSession,
  mapSecuredValue,
  Session,
} from '../../common';
import { Loader, LoaderOf } from '../../core';
import { SecuredUser, UserLoader } from '../user';
import {
  CreateFieldZoneInput,
  CreateFieldZoneOutput,
  FieldZone,
  FieldZoneListInput,
  FieldZoneListOutput,
  UpdateFieldZoneInput,
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
    @IdArg() id: ID
  ): Promise<FieldZone> {
    return await fieldZones.load(id);
  }

  @Query(() => FieldZoneListOutput, {
    description: 'Look up field zones',
  })
  async fieldZones(
    @AnonSession() session: Session,
    @Args({
      name: 'input',
      type: () => FieldZoneListInput,
      defaultValue: FieldZoneListInput.defaultVal,
    })
    input: FieldZoneListInput,
    @Loader(FieldZoneLoader) fieldZones: LoaderOf<FieldZoneLoader>
  ): Promise<FieldZoneListOutput> {
    const list = await this.fieldZoneService.list(input, session);
    fieldZones.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredUser)
  async director(
    @Parent() fieldZone: FieldZone,
    @Loader(UserLoader) users: LoaderOf<UserLoader>
  ): Promise<SecuredUser> {
    return await mapSecuredValue(fieldZone.director, (id) => users.load(id));
  }

  @Mutation(() => CreateFieldZoneOutput, {
    description: 'Create a field zone',
  })
  async createFieldZone(
    @LoggedInSession() session: Session,
    @Args('input') { fieldZone: input }: CreateFieldZoneInput
  ): Promise<CreateFieldZoneOutput> {
    const fieldZone = await this.fieldZoneService.create(input, session);
    return { fieldZone };
  }

  @Mutation(() => UpdateFieldZoneOutput, {
    description: 'Update a field zone',
  })
  async updateFieldZone(
    @LoggedInSession() session: Session,
    @Args('input') { fieldZone: input }: UpdateFieldZoneInput
  ): Promise<UpdateFieldZoneOutput> {
    const fieldZone = await this.fieldZoneService.update(input, session);
    return { fieldZone };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a field zone',
  })
  async deleteFieldZone(
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<boolean> {
    await this.fieldZoneService.delete(id, session);
    return true;
  }
}
