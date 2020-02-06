import {
  Resolver,
  Args,
  Query,
  Mutation,
  ResolveProperty,
  Parent,
} from '@nestjs/graphql';
import { IdArg, RequestUser, IRequestUser } from '../../common';
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
  async user(
    @RequestUser() token: IRequestUser,
    @IdArg() id: string,
    //
  ): Promise<User> {
    return this.userService.readOne(id, token);
  }

  @Query(() => UserListOutput, {
    description: 'Look up users',
  })
  async users(
    @RequestUser() token: string,
    @Args({
      name: 'input',
      type: () => UserListInput,
      defaultValue: UserListInput.defaultVal,
    })
    input: UserListInput,
  ): Promise<UserListOutput> {
    return this.userService.list(input, token);
  }

  @ResolveProperty(() => SecuredUnavailabilityList)
  async unavailabilities(
    @RequestUser() token: string,
    @Parent() { id }: User,
    @Args({
      name: 'input',
      type: () => UnavailabilityListInput,
      defaultValue: UnavailabilityListInput.defaultVal,
    })
    input: UnavailabilityListInput,
  ): Promise<SecuredUnavailabilityList> {
    return this.unavailabilityService.list(id, input, token);
  }

  @ResolveProperty(() => SecuredOrganizationList)
  async organizations(
    @RequestUser() token: IRequestUser,
    @Parent() { id }: User,
    @Args({
      name: 'input',
      type: () => OrganizationListInput,
      defaultValue: OrganizationListInput.defaultVal,
    })
    input: OrganizationListInput,
  ): Promise<SecuredOrganizationList> {
    return this.userService.listOrganizations(id, input, token);
  }

  @ResolveProperty(() => SecuredEducationList)
  async education(
    @RequestUser() token: string,
    @Parent() { id }: User,
    @Args({
      name: 'input',
      type: () => EducationListInput,
      defaultValue: EducationListInput.defaultVal,
    })
    input: EducationListInput,
  ): Promise<SecuredEducationList> {
    return this.educationService.list(id, input, token);
  }

  @Mutation(() => CreateUserOutput, {
    description: 'Create a user',
  })
  async createUser(
    @RequestUser() token: IRequestUser,
    @Args('input') { user: input }: CreateUserInput,
  ): Promise<CreateUserOutput> {
    const user = await this.userService.create(input, token);
    return { user };
  }

  @Mutation(() => UpdateUserOutput, {
    description: 'Update a user',
  })
  async updateUser(
    @RequestUser() token: IRequestUser,
    @Args('input') { user: input }: UpdateUserInput,
  ): Promise<UpdateUserOutput> {
    const user = await this.userService.update(input, token);
    return { user };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a user',
  })
  async deleteUser(@RequestUser() token: IRequestUser, @IdArg() id: string) {
    await this.userService.delete(id, token);
    return true;
  }
}
