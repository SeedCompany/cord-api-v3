import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { IdArg, ISession, Session } from '../../common';
import { SecuredUser, UserService } from '../user';
import {
  CreateFieldZoneInput,
  CreateFieldZoneOutput,
  FieldZone,
  FieldZoneListInput,
  FieldZoneListOutput,
  UpdateFieldZoneInput,
  UpdateFieldZoneOutput,
} from './dto';
import { FieldZoneService } from './field-zone.service';

@Resolver(FieldZone)
export class FieldZoneResolver {
  constructor(
    private readonly fieldZoneService: FieldZoneService,
    private readonly userService: UserService
  ) {}

  @Query(() => FieldZone, {
    description: 'Read one field zone by id',
  })
  async fieldZone(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<FieldZone> {
    return await this.fieldZoneService.readOne(id, session);
  }

  @Query(() => FieldZoneListOutput, {
    description: 'Look up field zones',
  })
  async fieldZones(
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => FieldZoneListInput,
      defaultValue: FieldZoneListInput.defaultVal,
    })
    input: FieldZoneListInput
  ): Promise<FieldZoneListOutput> {
    return this.fieldZoneService.list(input, session);
  }

  @ResolveField(() => SecuredUser)
  async director(
    @Parent() fieldZone: FieldZone,
    @Session() session: ISession
  ): Promise<SecuredUser> {
    const { value: id, ...rest } = fieldZone.director;
    const value = id ? await this.userService.readOne(id, session) : undefined;
    return {
      value,
      ...rest,
    };
  }

  @Mutation(() => CreateFieldZoneOutput, {
    description: 'Create a field zone',
  })
  async createFieldZone(
    @Session() session: ISession,
    @Args('input') { fieldZone: input }: CreateFieldZoneInput
  ): Promise<CreateFieldZoneOutput> {
    const fieldZone = await this.fieldZoneService.create(input, session);
    return { fieldZone };
  }

  @Mutation(() => UpdateFieldZoneOutput, {
    description: 'Update a field zone',
  })
  async updateFieldZone(
    @Session() session: ISession,
    @Args('input') { fieldZone: input }: UpdateFieldZoneInput
  ): Promise<UpdateFieldZoneOutput> {
    const fieldZone = await this.fieldZoneService.update(input, session);
    return { fieldZone };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a field zone',
  })
  async deleteFieldZone(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<boolean> {
    await this.fieldZoneService.delete(id, session);
    return true;
  }
}
