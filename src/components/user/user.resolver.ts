import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { compact } from 'lodash';
import { firstLettersOfWords, IdArg, ISession, Session } from '../../common';
import {
  OrganizationListInput,
  SecuredOrganizationList,
} from '../organization';
import { SecuredTimeZone, TimeZoneService } from '../timezone';
import {
  AssignOrganizationToUserInput,
  CheckEmailArgs,
  CreatePersonInput,
  CreatePersonOutput,
  RemoveOrganizationFromUserInput,
  UpdateUserInput,
  UpdateUserOutput,
  User,
  UserListInput,
  UserListOutput,
} from './dto';
import { EducationListInput, SecuredEducationList } from './education';
import {
  SecuredUnavailabilityList,
  UnavailabilityListInput,
} from './unavailability';
import { UserService } from './user.service';

@Resolver(User)
export class UserResolver {
  constructor(
    private readonly userService: UserService,
    private readonly timeZoneService: TimeZoneService
  ) {}

  @Query(() => User, {
    description: 'Look up a user by its ID',
  })
  async user(@Session() session: ISession, @IdArg() id: string): Promise<User> {
    return await this.userService.readOne(id, session);
  }

  @ResolveField(() => String, { nullable: true })
  fullName(@Parent() user: User): string | undefined {
    const realName = compact([
      user.realFirstName.value,
      user.realLastName.value,
    ]).join(' ');
    if (realName) {
      return realName;
    }
    const displayName = compact([
      user.displayFirstName.value,
      user.displayLastName.value,
    ]).join(' ');
    if (displayName) {
      return displayName;
    }

    return undefined;
  }

  @ResolveField(() => String, { nullable: true })
  firstName(@Parent() user: User): string | undefined {
    return user.realFirstName.value || user.displayFirstName.value || undefined;
  }

  @ResolveField(() => String, { nullable: true })
  avatarLetters(@Parent() user: User): string | undefined {
    const name = this.fullName(user);
    return name ? firstLettersOfWords(name) : undefined;
  }

  @ResolveField(() => SecuredTimeZone)
  async timezone(@Parent() user: User): Promise<SecuredTimeZone> {
    const tz = user.timezone.value;
    const zones = await this.timeZoneService.timezones();
    return {
      ...user.timezone,
      value: tz ? zones[tz] : undefined,
    };
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
    input: UserListInput
  ): Promise<UserListOutput> {
    return this.userService.list(input, session);
  }

  @Query(() => Boolean, {
    description: 'Checks whether a provided email already exists',
  })
  async checkEmail(@Args() { email }: CheckEmailArgs): Promise<boolean> {
    return await this.userService.checkEmail(email);
  }

  @ResolveField(() => SecuredUnavailabilityList)
  async unavailabilities(
    @Session() session: ISession,
    @Parent() { id }: User,
    @Args({
      name: 'input',
      type: () => UnavailabilityListInput,
      defaultValue: UnavailabilityListInput.defaultVal,
    })
    input: UnavailabilityListInput
  ): Promise<SecuredUnavailabilityList> {
    return this.userService.listUnavailabilities(id, input, session);
  }

  @ResolveField(() => SecuredOrganizationList)
  async organizations(
    @Session() session: ISession,
    @Parent() { id }: User,
    @Args({
      name: 'input',
      type: () => OrganizationListInput,
      defaultValue: OrganizationListInput.defaultVal,
    })
    input: OrganizationListInput
  ): Promise<SecuredOrganizationList> {
    return this.userService.listOrganizations(id, input, session);
  }

  @ResolveField(() => SecuredEducationList)
  async education(
    @Session() session: ISession,
    @Parent() { id }: User,
    @Args({
      name: 'input',
      type: () => EducationListInput,
      defaultValue: EducationListInput.defaultVal,
    })
    input: EducationListInput
  ): Promise<SecuredEducationList> {
    return this.userService.listEducations(id, input, session);
  }

  @Mutation(() => CreatePersonOutput, {
    description: 'Create a person',
  })
  async createPerson(
    @Session() session: ISession,
    @Args('input') { person: input }: CreatePersonInput
  ): Promise<CreatePersonOutput> {
    const userId = await this.userService.create(input, session);
    const user = await this.userService.readOne(userId, session);
    return { user };
  }

  @Mutation(() => UpdateUserOutput, {
    description: 'Update a user',
  })
  async updateUser(
    @Session() session: ISession,
    @Args('input') { user: input }: UpdateUserInput
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

  @Query(() => Boolean, {
    description: 'Check Consistency across User Nodes',
  })
  async checkUserConsistency(@Session() session: ISession): Promise<boolean> {
    return await this.userService.checkUserConsistency(session);
  }

  @Mutation(() => Boolean, {
    description: 'Assign organization OR primaryOrganization to user',
  })
  async assignOrganizationToUser(
    @Session() session: ISession,
    @Args('input') input: AssignOrganizationToUserInput
  ): Promise<boolean> {
    return await this.userService.assignOrganizationToUser(
      input.request,
      session
    );
  }

  @Mutation(() => Boolean, {
    description: 'Remove organization OR primaryOrganization from user',
  })
  async removeOrganizationFromUser(
    @Session() session: ISession,
    @Args('input') input: RemoveOrganizationFromUserInput
  ): Promise<boolean> {
    return await this.userService.removeOrganizationFromUser(
      input.request,
      session
    );
  }
}
