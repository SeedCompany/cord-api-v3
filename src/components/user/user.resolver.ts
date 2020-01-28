import {
  Resolver,
  Args,
  Query,
  Mutation,
  ResolveProperty,
  Parent,
} from '@nestjs/graphql';
import { IdArg, Token } from '../../common';
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
  SecuredUnavailabilityList,
  UnavailabilityListInput,
  UnavailabilityService,
} from './unavailability';
import { UserService } from './user.service';

@Resolver(User.classType)
export class UserResolver {
  constructor(
    private readonly userService: UserService,
    private readonly unavailabilityService: UnavailabilityService,
  ) {}

  @Query(() => User, {
    description: 'Look up a user by its ID',
  })
  async user(@Token() token: string, @IdArg() id: string): Promise<User> {
    return this.userService.readOne(id, token);
  }

  @Query(() => UserListOutput, {
    description: 'Look up users',
  })
  async users(
    @Token() token: string,
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
    @Token() token: string,
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
    @Token() token: string,
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

  @Mutation(() => CreateUserOutput, {
    description: 'Create a user',
  })
  async createUser(
    @Token() token: string,
    @Args('input') { user: input }: CreateUserInput,
  ): Promise<CreateUserOutput> {
    const user = await this.userService.create(input, token);
    return { user };
  }

  @Mutation(() => UpdateUserOutput, {
    description: 'Update a user',
  })
  async updateUser(
    @Token() token: string,
    @Args('input') { user: input }: UpdateUserInput,
  ): Promise<UpdateUserOutput> {
    const user = await this.userService.update(input, token);
    return { user };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a user',
  })
  async deleteUser(@Token() token: string, @IdArg() id: string) {
    await this.userService.delete(id, token);
    return true;
  }
}
