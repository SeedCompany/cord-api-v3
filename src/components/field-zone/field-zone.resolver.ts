import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { AnonSession, ID, IdArg, LoggedInSession, Session } from '../../common';
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
    @AnonSession() session: Session,
    @IdArg() id: ID
  ): Promise<FieldZone> {
    return await this.fieldZoneService.readOne(id, session);
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
    input: FieldZoneListInput
  ): Promise<FieldZoneListOutput> {
    return await this.fieldZoneService.list(input, session);
  }

  @ResolveField(() => SecuredUser)
  async director(
    @Parent() fieldZone: FieldZone,
    @AnonSession() session: Session
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
