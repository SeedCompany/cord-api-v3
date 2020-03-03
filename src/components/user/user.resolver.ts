import {
  Resolver,
  Args,
  Query,
  Mutation,
  ResolveProperty,
  Parent,
} from '@nestjs/graphql';
import { IdArg } from '../../common';
import { ISession, Session } from '../auth';
import {
  OrganizationListInput,
  SecuredOrganizationList,
} from '../organization';
import {
  CreateUserInput,
  CreateUserOutput,
  UpdateUserInput,
  UpdateUserOutput,
  User,
  UserListInput,
  UserListOutput,
  UserEmail,
} from './dto';
import {
  EducationListInput,
  EducationService,
  SecuredEducationList,
} from './education';
import {
  SecuredUnavailabilityList,
  UnavailabilityListInput,
  UnavailabilityService,
} from './unavailability';
import { UserService } from './user.service';

@Resolver(User.classType)
export class UserResolver {
  constructor(
    private readonly userService: UserService,
    private readonly educationService: EducationService,
    private readonly unavailabilityService: UnavailabilityService,
  ) {}

  @Query(() => User, {
    description: 'Look up a user by its ID',
  })
  async user(@Session() session: ISession, @IdArg() id: string): Promise<User> {
    return this.userService.readOne(id, session);
  }

  @Query(() => UserListOutput, {
    description: 'Look up users',
  })
  async users(
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => UserListInput,
      defaultValue: UserListInput.defaultVal,
    })
    input: UserListInput,
  ): Promise<UserListOutput> {
    return this.userService.list(input, session);
  }

  @Query(() => Boolean, {
    description: "Check out whether a provided email exists or not in User Table"
  })
  async checkEmail(
    @Session() session: ISession,
    @Args({
      name: "input",
      type: () => UserEmail
    })
    input: UserEmail,
  ): Promise<Boolean>
  {
    return this.userService.checkEmail(input, session)
  }

  @ResolveProperty(() => SecuredUnavailabilityList)
  async unavailabilities(
    @Session() session: ISession,
    @Parent() { id }: User,
    @Args({
      name: 'input',
      type: () => UnavailabilityListInput,
      defaultValue: UnavailabilityListInput.defaultVal,
    })
    input: UnavailabilityListInput,
  ): Promise<SecuredUnavailabilityList> {
    input = {...input, filter: {userId: id}};
    return this.unavailabilityService.list(input, session);
  }

  @ResolveProperty(() => SecuredOrganizationList)
  async organizations(
    @Session() session: ISession,
    @Parent() { id }: User,
    @Args({
      name: 'input',
      type: () => OrganizationListInput,
      defaultValue: OrganizationListInput.defaultVal,
    })
    input: OrganizationListInput,
  ): Promise<SecuredOrganizationList> {
    return this.userService.listOrganizations(id, input, session);
  }

  @ResolveProperty(() => SecuredEducationList)
  async education(
    @Session() session: ISession,
    @Parent() { id }: User,
    @Args({
      name: 'input',
      type: () => EducationListInput,
      defaultValue: EducationListInput.defaultVal,
    })
    input: EducationListInput,
  ): Promise<SecuredEducationList> {
    input = {...input, filter: {userId: id}};
    return this.educationService.list(input, session);
  }

  @Mutation(() => CreateUserOutput, {
    description: 'Create a user',
  })
  async createUser(
    @Session() session: ISession,
    @Args('input') { user: input }: CreateUserInput,
  ): Promise<CreateUserOutput> {
    const user = await this.userService.create(input, session);
    return { user };
  }

  @Mutation(() => UpdateUserOutput, {
    description: 'Update a user',
  })
  async updateUser(
    @Session() session: ISession,
    @Args('input') { user: input }: UpdateUserInput,
  ): Promise<UpdateUserOutput> {
    const user = await this.userService.update(input, session);
    return { user };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a user',
  })
  async deleteUser(@Session() session: ISession, @IdArg() id: string) {
    await this.userService.delete(id, session);
    return true;
  }
}
