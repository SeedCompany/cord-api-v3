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
  firstLettersOfWords,
  type ID,
  IdArg,
  IdField,
  ListArg,
  NotFoundException,
  ReadAfterCreationFailed,
} from '~/common';
import { Loader, type LoaderOf } from '~/core';
import { Identity } from '~/core/authentication';
import { LocationLoader } from '../location';
import { LocationListInput, SecuredLocationList } from '../location/dto';
import { OrganizationLoader } from '../organization';
import {
  OrganizationListInput,
  SecuredOrganizationList,
} from '../organization/dto';
import { PartnerLoader, PartnerService } from '../partner';
import { Partner, PartnerListInput, SecuredPartnerList } from '../partner/dto';
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
    private readonly partnerService: PartnerService,
    private readonly timeZoneService: TimeZoneService,
    private readonly identity: Identity,
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
    @ListArg(UserListInput) input: UserListInput,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ): Promise<UserListOutput> {
    const list = await this.userService.list(input);
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
  async userByEmail(@Args() { email }: CheckEmailArgs): Promise<User | null> {
    // TODO move to auth policy?
    if (this.identity.isAnonymous) {
      return null;
    }
    return await this.userService.getUserByEmailAddress(email);
  }

  @ResolveField(() => SecuredUnavailabilityList)
  async unavailabilities(
    @Parent() { id }: User,
    @ListArg(UnavailabilityListInput) input: UnavailabilityListInput,
    @Loader(UnavailabilityLoader)
    unavailabilities: LoaderOf<UnavailabilityLoader>,
  ): Promise<SecuredUnavailabilityList> {
    const list = await this.userService.listUnavailabilities(id, input);
    unavailabilities.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredOrganizationList)
  async organizations(
    @Parent() { id }: User,
    @ListArg(OrganizationListInput) input: OrganizationListInput,
    @Loader(OrganizationLoader) organizations: LoaderOf<OrganizationLoader>,
  ): Promise<SecuredOrganizationList> {
    const list = await this.userService.listOrganizations(id, input);
    organizations.primeAll(list.items);
    return list;
  }

  @ResolveField(() => Partner, { nullable: true })
  async primaryOrganization(@Parent() { id }: User): Promise<Partner | null> {
    const primaryOrgId = await this.userService.getPrimaryOrganizationId(id);
    return primaryOrgId
      ? await this.partnerService.readOnePartnerByOrgId(primaryOrgId)
      : null;
  }

  @ResolveField(() => SecuredPartnerList)
  async partners(
    @Parent() { id }: User,
    @ListArg(PartnerListInput) input: PartnerListInput,
    @Loader(PartnerLoader) partners: LoaderOf<PartnerLoader>,
  ): Promise<SecuredPartnerList> {
    const list = await this.userService.listPartners(id, input);
    partners.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredEducationList)
  async education(
    @Parent() { id }: User,
    @ListArg(EducationListInput) input: EducationListInput,
    @Loader(EducationLoader) educations: LoaderOf<EducationLoader>,
  ): Promise<SecuredEducationList> {
    const list = await this.userService.listEducations(id, input);
    educations.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredLocationList)
  async locations(
    @Parent() user: User,
    @ListArg(LocationListInput) input: LocationListInput,
    @Loader(LocationLoader) locations: LoaderOf<LocationLoader>,
  ): Promise<SecuredLocationList> {
    const list = await this.userService.listLocations(user, input);
    locations.primeAll(list.items);
    return list;
  }

  @ResolveField(() => [KnownLanguage])
  async knownLanguages(
    @Parent() { id }: User,
  ): Promise<readonly KnownLanguage[]> {
    return await this.userService.listKnownLanguages(id);
  }

  @Mutation(() => CreatePersonOutput, {
    description: 'Create a person',
  })
  async createPerson(
    @Args('input') { person: input }: CreatePersonInput,
  ): Promise<CreatePersonOutput> {
    const userId = await this.userService.create(input);
    const user = await this.userService.readOne(userId).catch((e) => {
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
    @Args('input') { user: input }: UpdateUserInput,
  ): Promise<UpdateUserOutput> {
    const user = await this.userService.update(input);
    return { user };
  }

  @Mutation(() => DeleteUserOutput, {
    description: 'Delete a user',
  })
  async deleteUser(@IdArg() id: ID): Promise<DeleteUserOutput> {
    await this.userService.delete(id);
    return { success: true };
  }

  @Mutation(() => User, {
    description: 'Add a location to a user',
  })
  async addLocationToUser(
    @Args() { userId, locationId }: ModifyLocationArgs,
  ): Promise<User> {
    await this.userService.addLocation(userId, locationId);
    return await this.userService.readOne(userId);
  }

  @Mutation(() => User, {
    description: 'Remove a location from a user',
  })
  async removeLocationFromUser(
    @Args() { userId, locationId }: ModifyLocationArgs,
  ): Promise<User> {
    await this.userService.removeLocation(userId, locationId);
    return await this.userService.readOne(userId);
  }

  @Mutation(() => AssignOrganizationToUserOutput, {
    description: 'Assign organization OR primaryOrganization to user',
  })
  async assignOrganizationToUser(
    @Args('input') input: AssignOrganizationToUserInput,
  ): Promise<AssignOrganizationToUserOutput> {
    await this.userService.assignOrganizationToUser(input.assignment);
    const partner = await this.partnerService.readOnePartnerByOrgId(
      input.assignment.orgId,
    );

    return { partner };
  }

  @Mutation(() => RemoveOrganizationFromUserOutput, {
    description: 'Remove organization OR primaryOrganization from user',
  })
  async removeOrganizationFromUser(
    @Args('input') input: RemoveOrganizationFromUserInput,
  ): Promise<RemoveOrganizationFromUserOutput> {
    await this.userService.removeOrganizationFromUser(input.assignment);
    const partner = await this.partnerService.readOnePartnerByOrgId(
      input.assignment.orgId,
    );
    return { partner };
  }

  @Mutation(() => User, {
    description: 'Create known language to user',
  })
  async createKnownLanguage(
    @Args() args: ModifyKnownLanguageArgs,
  ): Promise<User> {
    await this.userService.createKnownLanguage(args);
    return await this.userService.readOne(args.userId);
  }

  @Mutation(() => User, {
    description: 'Delete known language from user',
  })
  async deleteKnownLanguage(
    @Args() args: ModifyKnownLanguageArgs,
  ): Promise<User> {
    await this.userService.deleteKnownLanguage(args);
    return await this.userService.readOne(args.userId);
  }
}
