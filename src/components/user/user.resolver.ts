import {
  Args,
  ArgsType,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  AnonSession,
  firstLettersOfWords,
  ID,
  IdArg,
  IdField,
  ListArg,
  LoggedInSession,
  NotFoundException,
  ReadAfterCreationFailed,
  Session,
} from '~/common';
import { Loader, LoaderOf } from '~/core';
import { LocationLoader } from '../location';
import { LocationListInput, SecuredLocationList } from '../location/dto';
import { OrganizationLoader } from '../organization';
import {
  OrganizationListInput,
  SecuredOrganizationList,
} from '../organization/dto';
import { PartnerLoader } from '../partner';
import { PartnerListInput, SecuredPartnerList } from '../partner/dto';
import { TimeZoneService } from '../timezone';
import { SecuredTimeZone } from '../timezone/timezone.dto';
import {
  AssignOrganizationToUserInput,
  AssignOrganizationToUserOutput,
  CheckEmailArgs,
  CreatePersonInput,
  CreatePersonOutput,
  DeleteUserOutput,
  KnownLanguage,
  ModifyKnownLanguageArgs,
  RemoveOrganizationFromUserInput,
  RemoveOrganizationFromUserOutput,
  UpdateUserInput,
  UpdateUserOutput,
  User,
  UserListInput,
  UserListOutput,
} from './dto';
import { EducationLoader } from './education';
import { EducationListInput, SecuredEducationList } from './education/dto';
import { fullName } from './fullName';
import { UnavailabilityLoader } from './unavailability';
import {
  SecuredUnavailabilityList,
  UnavailabilityListInput,
} from './unavailability/dto';
import { UserLoader } from './user.loader';
import { UserService } from './user.service';

@ArgsType()
class ModifyLocationArgs {
  @IdField()
  userId: ID;

  @IdField()
  locationId: ID;
}

@Resolver(User)
export class UserResolver {
  constructor(
    private readonly userService: UserService,
    private readonly timeZoneService: TimeZoneService,
  ) {}

  @Query(() => User, {
    description: 'Look up a user by its ID',
  })
  async user(
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
    @IdArg() id: ID,
  ): Promise<User> {
    return await users.load(id);
  }

  @ResolveField(() => String, { nullable: true })
  fullName(@Parent() user: User): string | undefined {
    return fullName(user);
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
    @AnonSession() session: Session,
    @ListArg(UserListInput) input: UserListInput,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ): Promise<UserListOutput> {
    const list = await this.userService.list(input, session);
    users.primeAll(list.items);
    return list;
  }

  @Query(() => Boolean, {
    description: 'Checks whether a provided email already exists',
  })
  async checkEmail(@Args() { email }: CheckEmailArgs): Promise<boolean> {
    return await this.userService.checkEmail(email);
  }

  @Query(() => User, {
    description: 'Returns a user for a given email address',
    nullable: true,
  })
  async userByEmail(
    @LoggedInSession() session: Session,
    @Args() { email }: CheckEmailArgs,
  ): Promise<User | null> {
    return await this.userService.getUserByEmailAddress(email, session);
  }

  @ResolveField(() => SecuredUnavailabilityList)
  async unavailabilities(
    @AnonSession() session: Session,
    @Parent() { id }: User,
    @ListArg(UnavailabilityListInput) input: UnavailabilityListInput,
    @Loader(UnavailabilityLoader)
    unavailabilities: LoaderOf<UnavailabilityLoader>,
  ): Promise<SecuredUnavailabilityList> {
    const list = await this.userService.listUnavailabilities(
      id,
      input,
      session,
    );
    unavailabilities.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredOrganizationList)
  async organizations(
    @AnonSession() session: Session,
    @Parent() { id }: User,
    @ListArg(OrganizationListInput) input: OrganizationListInput,
    @Loader(OrganizationLoader) organizations: LoaderOf<OrganizationLoader>,
  ): Promise<SecuredOrganizationList> {
    const list = await this.userService.listOrganizations(id, input, session);
    organizations.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredPartnerList)
  async partners(
    @AnonSession() session: Session,
    @Parent() { id }: User,
    @ListArg(PartnerListInput) input: PartnerListInput,
    @Loader(PartnerLoader) partners: LoaderOf<PartnerLoader>,
  ): Promise<SecuredPartnerList> {
    const list = await this.userService.listPartners(id, input, session);
    partners.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredEducationList)
  async education(
    @AnonSession() session: Session,
    @Parent() { id }: User,
    @ListArg(EducationListInput) input: EducationListInput,
    @Loader(EducationLoader) educations: LoaderOf<EducationLoader>,
  ): Promise<SecuredEducationList> {
    const list = await this.userService.listEducations(id, input, session);
    educations.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredLocationList)
  async locations(
    @AnonSession() session: Session,
    @Parent() user: User,
    @ListArg(LocationListInput) input: LocationListInput,
    @Loader(LocationLoader) locations: LoaderOf<LocationLoader>,
  ): Promise<SecuredLocationList> {
    const list = await this.userService.listLocations(user, input, session);
    locations.primeAll(list.items);
    return list;
  }

  @ResolveField(() => [KnownLanguage])
  async knownLanguages(
    @AnonSession() session: Session,
    @Parent() { id }: User,
  ): Promise<readonly KnownLanguage[]> {
    return await this.userService.listKnownLanguages(id, session);
  }

  @Mutation(() => CreatePersonOutput, {
    description: 'Create a person',
  })
  async createPerson(
    @LoggedInSession() session: Session,
    @Args('input') { person: input }: CreatePersonInput,
  ): Promise<CreatePersonOutput> {
    const userId = await this.userService.create(input, session);
    const user = await this.userService.readOne(userId, session).catch((e) => {
      throw e instanceof NotFoundException
        ? new ReadAfterCreationFailed(User)
        : e;
    });
    return { user };
  }

  @Mutation(() => UpdateUserOutput, {
    description: 'Update a user',
  })
  async updateUser(
    @LoggedInSession() session: Session,
    @Args('input') { user: input }: UpdateUserInput,
  ): Promise<UpdateUserOutput> {
    const user = await this.userService.update(input, session);
    return { user };
  }

  @Mutation(() => DeleteUserOutput, {
    description: 'Delete a user',
  })
  async deleteUser(
    @LoggedInSession() session: Session,
    @IdArg() id: ID,
  ): Promise<DeleteUserOutput> {
    await this.userService.delete(id, session);
    return { success: true };
  }

  @Mutation(() => User, {
    description: 'Add a location to a user',
  })
  async addLocationToUser(
    @LoggedInSession() session: Session,
    @Args() { userId, locationId }: ModifyLocationArgs,
  ): Promise<User> {
    await this.userService.addLocation(userId, locationId);
    return await this.userService.readOne(userId, session);
  }

  @Mutation(() => User, {
    description: 'Remove a location from a user',
  })
  async removeLocationFromUser(
    @LoggedInSession() session: Session,
    @Args() { userId, locationId }: ModifyLocationArgs,
  ): Promise<User> {
    await this.userService.removeLocation(userId, locationId);
    return await this.userService.readOne(userId, session);
  }

  @Mutation(() => AssignOrganizationToUserOutput, {
    description: 'Assign organization OR primaryOrganization to user',
  })
  async assignOrganizationToUser(
    @LoggedInSession() session: Session,
    @Args('input') input: AssignOrganizationToUserInput,
  ): Promise<AssignOrganizationToUserOutput> {
    await this.userService.assignOrganizationToUser(input.request);
    return { success: true };
  }

  @Mutation(() => RemoveOrganizationFromUserOutput, {
    description: 'Remove organization OR primaryOrganization from user',
  })
  async removeOrganizationFromUser(
    @LoggedInSession() session: Session,
    @Args('input') input: RemoveOrganizationFromUserInput,
  ): Promise<RemoveOrganizationFromUserOutput> {
    await this.userService.removeOrganizationFromUser(input.request);
    return { success: true };
  }

  @Mutation(() => User, {
    description: 'Create known language to user',
  })
  async createKnownLanguage(
    @LoggedInSession() session: Session,
    @Args() args: ModifyKnownLanguageArgs,
  ): Promise<User> {
    await this.userService.createKnownLanguage(args);
    return await this.userService.readOne(args.userId, session);
  }

  @Mutation(() => User, {
    description: 'Delete known language from user',
  })
  async deleteKnownLanguage(
    @LoggedInSession() session: Session,
    @Args() args: ModifyKnownLanguageArgs,
  ): Promise<User> {
    await this.userService.deleteKnownLanguage(args);
    return await this.userService.readOne(args.userId, session);
  }
}
