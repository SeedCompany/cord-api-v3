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
  IdArg,
  IdField,
  LoggedInSession,
  Session,
} from '../../common';
import { LocationListInput, SecuredLocationList } from '../location';
import {
  OrganizationListInput,
  SecuredOrganizationList,
} from '../organization';
import { PartnerListInput, SecuredPartnerList } from '../partner';
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
import {
  KnownLanguage,
  ModifyKnownLanguageArgs,
} from './dto/known-language.dto';
import { EducationListInput, SecuredEducationList } from './education';
import {
  SecuredUnavailabilityList,
  UnavailabilityListInput,
} from './unavailability';
import { fullName, UserService } from './user.service';

@ArgsType()
class ModifyLocationArgs {
  @IdField()
  userId: string;

  @IdField()
  locationId: string;
}

@Resolver(User)
export class UserResolver {
  constructor(
    private readonly userService: UserService,
    private readonly timeZoneService: TimeZoneService
  ) {}

  @Query(() => User, {
    description: 'Look up a user by its ID',
  })
  async user(
    @AnonSession() session: Session,
    @IdArg() id: string
  ): Promise<User> {
    return await this.userService.readOne(id, session);
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
    @AnonSession() session: Session,
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
    @AnonSession() session: Session,
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

  @ResolveField(() => SecuredPartnerList)
  async partners(
    @AnonSession() session: Session,
    @Parent() { id }: User,
    @Args({
      name: 'input',
      type: () => PartnerListInput,
      defaultValue: PartnerListInput.defaultVal,
    })
    input: PartnerListInput
  ): Promise<SecuredPartnerList> {
    return this.userService.listPartners(id, input, session);
  }

  @ResolveField(() => SecuredEducationList)
  async education(
    @AnonSession() session: Session,
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

  @ResolveField(() => SecuredLocationList)
  async locations(
    @AnonSession() session: Session,
    @Parent() user: User,
    @Args({
      name: 'input',
      type: () => LocationListInput,
      defaultValue: LocationListInput.defaultVal,
    })
    input: LocationListInput
  ): Promise<SecuredLocationList> {
    return this.userService.listLocations(user.id, input, session);
  }

  @ResolveField(() => [KnownLanguage])
  async knownLanguages(
    @AnonSession() session: Session,
    @Parent() { id }: User
  ): Promise<KnownLanguage[]> {
    return await this.userService.listKnownLanguages(id, session);
  }

  @Mutation(() => CreatePersonOutput, {
    description: 'Create a person',
  })
  async createPerson(
    @LoggedInSession() session: Session,
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
    @LoggedInSession() session: Session,
    @Args('input') { user: input }: UpdateUserInput
  ): Promise<UpdateUserOutput> {
    const user = await this.userService.update(input, session);
    return { user };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a user',
  })
  async deleteUser(@LoggedInSession() session: Session, @IdArg() id: string) {
    await this.userService.delete(id, session);
    return true;
  }

  @Mutation(() => User, {
    description: 'Add a location to a user',
  })
  async addLocationToUser(
    @LoggedInSession() session: Session,
    @Args() { userId, locationId }: ModifyLocationArgs
  ): Promise<User> {
    await this.userService.addLocation(userId, locationId, session);
    return await this.userService.readOne(userId, session);
  }

  @Mutation(() => User, {
    description: 'Remove a location from a user',
  })
  async removeLocationFromUser(
    @LoggedInSession() session: Session,
    @Args() { userId, locationId }: ModifyLocationArgs
  ): Promise<User> {
    await this.userService.removeLocation(userId, locationId, session);
    return await this.userService.readOne(userId, session);
  }

  @Query(() => Boolean, {
    description: 'Check Consistency across User Nodes',
  })
  async checkUserConsistency(
    @AnonSession() session: Session
  ): Promise<boolean> {
    return await this.userService.checkUserConsistency(session);
  }

  @Mutation(() => Boolean, {
    description: 'Assign organization OR primaryOrganization to user',
  })
  async assignOrganizationToUser(
    @LoggedInSession() session: Session,
    @Args('input') input: AssignOrganizationToUserInput
  ): Promise<boolean> {
    await this.userService.assignOrganizationToUser(input.request, session);
    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Remove organization OR primaryOrganization from user',
  })
  async removeOrganizationFromUser(
    @LoggedInSession() session: Session,
    @Args('input') input: RemoveOrganizationFromUserInput
  ): Promise<boolean> {
    await this.userService.removeOrganizationFromUser(input.request, session);
    return true;
  }

  @Mutation(() => User, {
    description: 'Create known language to user',
  })
  async createKnownLanguage(
    @LoggedInSession() session: Session,
    @Args() { userId, languageId, languageProficiency }: ModifyKnownLanguageArgs
  ): Promise<User> {
    await this.userService.createKnownLanguage(
      userId,
      languageId,
      languageProficiency,
      session
    );
    return await this.userService.readOne(userId, session);
  }

  @Mutation(() => User, {
    description: 'Delete known language from user',
  })
  async deleteKnownLanguage(
    @LoggedInSession() session: Session,
    @Args() { userId, languageId, languageProficiency }: ModifyKnownLanguageArgs
  ): Promise<User> {
    await this.userService.deleteKnownLanguage(
      userId,
      languageId,
      languageProficiency,
      session
    );
    return await this.userService.readOne(userId, session);
  }
}
