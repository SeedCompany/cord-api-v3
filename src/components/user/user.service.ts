import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  type ID,
  type ObjectView,
  Role,
  SecuredList,
  ServerException,
  UnauthorizedException,
  type UnsecuredDto,
} from '~/common';
import { HandleIdLookup, ILogger, Logger } from '~/core';
import { Identity } from '~/core/authentication';
import { Transactional } from '~/core/database';
import { IEventBus } from '~/core/events';
import { Privileges } from '../authorization';
import { AssignableRoles } from '../authorization/dto/assignable-roles.dto';
import { LocationService } from '../location';
import {
  type LocationListInput,
  type SecuredLocationList,
} from '../location/dto';
import { OrganizationService } from '../organization';
import {
  type OrganizationListInput,
  type SecuredOrganizationList,
} from '../organization/dto';
import { PartnerService } from '../partner';
import { type PartnerListInput, type SecuredPartnerList } from '../partner/dto';
import {
  type AssignOrganizationToUser,
  type CreatePerson,
  type ModifyKnownLanguageArgs,
  type RemoveOrganizationFromUser,
  type SystemAgent,
  UpdateUser,
  User,
  type UserListInput,
  type UserListOutput,
} from './dto';
import { EducationService } from './education';
import {
  type EducationListInput,
  type SecuredEducationList,
} from './education/dto';
import { UserUpdatedEvent } from './events/user-updated.event';
import { KnownLanguageRepository } from './known-language.repository';
import { UnavailabilityService } from './unavailability';
import {
  type SecuredUnavailabilityList,
  type UnavailabilityListInput,
} from './unavailability/dto';
import { UserRepository } from './user.repository';

@Injectable()
export class UserService {
  constructor(
    private readonly educations: EducationService,
    private readonly organizations: OrganizationService,
    @Inject(forwardRef(() => PartnerService))
    private readonly partners: PartnerService & {},
    private readonly unavailabilities: UnavailabilityService,
    private readonly privileges: Privileges,
    private readonly locationService: LocationService,
    private readonly knownLanguages: KnownLanguageRepository,
    private readonly identity: Identity,
    private readonly events: IEventBus,
    private readonly userRepo: UserRepository,
    @Logger('user:service') private readonly logger: ILogger,
  ) {}

  async create(input: CreatePerson): Promise<ID> {
    if (
      input.roles &&
      input.roles.length > 0 &&
      // Note: session is only omitted for creating RootUser
      this.identity.currentIfInCtx
    ) {
      this.verifyRolesAreAssignable(input.roles);
    }

    const { id } = await this.userRepo.create(input);
    return id;
  }

  @HandleIdLookup(User)
  async readOne(id: ID, _view?: ObjectView): Promise<User> {
    const user = await this.userRepo.readOne(id);
    return this.secure(user);
  }

  async readOneUnsecured(id: ID): Promise<UnsecuredDto<User>> {
    return await this.userRepo.readOne(id);
  }

  async readMany(ids: readonly ID[]) {
    const users = await this.userRepo.readMany(ids);
    return users.map((dto) => this.secure(dto));
  }

  async readManyActors(
    ids: readonly ID[],
  ): Promise<ReadonlyArray<User | SystemAgent>> {
    const users = await this.userRepo.readManyActors(ids);
    return users.map((dto) =>
      dto.__typename === 'User' ? this.secure(dto) : (dto as SystemAgent),
    );
  }

  secure(user: UnsecuredDto<User>): User {
    return this.privileges.for(User).secure(user);
  }

  @Transactional()
  async update(input: UpdateUser): Promise<User> {
    this.logger.debug('mutation update User', { input });
    const user = await this.userRepo.readOne(input.id);

    const changes = this.userRepo.getActualChanges(user, input);

    this.privileges.for(User, user).verifyChanges(changes);

    if (Object.keys(changes).length === 0) {
      return this.secure(user);
    }

    if (changes.roles) {
      this.verifyRolesAreAssignable(changes.roles);
    }

    input = {
      id: user.id,
      ...changes,
    };
    const updated = await this.userRepo.update(input);

    const event = new UserUpdatedEvent(user, updated, input);
    await this.events.publish(event);

    return this.secure(updated);
  }

  async delete(id: ID): Promise<void> {
    const object = await this.readOne(id);
    await this.userRepo.delete(id, object);
  }

  async list(input: UserListInput): Promise<UserListOutput> {
    const results = await this.userRepo.list(input);
    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto)),
    };
  }

  getAssignableRoles() {
    const privileges = this.privileges.for(AssignableRoles);
    const assignableRoles = new Set(
      [...Role].filter((role) => privileges.can('edit', role)),
    );
    return assignableRoles;
  }

  verifyRolesAreAssignable(roles: readonly Role[]) {
    const allowed = this.getAssignableRoles();
    const invalid = roles.filter((role) => !allowed.has(role));
    if (invalid.length === 0) {
      return;
    }
    const invalidStr = invalid.join(', ');
    throw new UnauthorizedException(
      `You do not have the permission to assign users the roles: ${invalidStr}`,
    );
  }

  async listEducations(
    userId: ID,
    input: EducationListInput,
  ): Promise<SecuredEducationList> {
    const user = await this.userRepo.readOne(userId);
    const perms = this.privileges.for(User, user).all.education;

    if (!perms.read) {
      return SecuredList.Redacted;
    }
    const result = await this.educations.list({
      ...input,
      filter: {
        ...input.filter,
        userId: userId,
      },
    });
    return {
      ...result,
      canRead: perms.read,
      canCreate: perms.create,
    };
  }

  async listOrganizations(
    userId: ID,
    input: OrganizationListInput,
  ): Promise<SecuredOrganizationList> {
    const user = await this.userRepo.readOne(userId);
    const perms = this.privileges.for(User, user).all.organization;

    if (!perms.read) {
      return SecuredList.Redacted;
    }
    const result = await this.organizations.list({
      ...input,
      filter: {
        ...input.filter,
        userId: userId,
      },
    });
    return {
      ...result,
      canRead: perms.read,
      canCreate: perms.edit,
    };
  }

  async listPartners(
    userId: ID,
    input: PartnerListInput,
  ): Promise<SecuredPartnerList> {
    const user = await this.userRepo.readOne(userId);
    const perms = this.privileges.for(User, user).all.partner;
    const result = await this.partners.list({
      ...input,
      filter: {
        ...input.filter,
        userId,
      },
    });
    return {
      ...result,
      canRead: perms.read,
      canCreate: perms.edit,
    };
  }

  async listUnavailabilities(
    userId: ID,
    input: UnavailabilityListInput,
  ): Promise<SecuredUnavailabilityList> {
    const user = await this.userRepo.readOne(userId);
    const perms = this.privileges.for(User, user).all.unavailability;

    if (!perms.read) {
      return SecuredList.Redacted;
    }
    const result = await this.unavailabilities.list({
      ...input,
      filter: {
        ...input.filter,
        userId: userId,
      },
    });

    return {
      ...result,
      canRead: perms.read,
      canCreate: perms.create,
    };
  }

  async addLocation(userId: ID, locationId: ID): Promise<void> {
    try {
      await this.locationService.addLocationToNode(
        'User',
        userId,
        'locations',
        locationId,
      );
    } catch (e) {
      throw new ServerException('Could not add location to user', e);
    }
  }

  async removeLocation(userId: ID, locationId: ID): Promise<void> {
    try {
      await this.locationService.removeLocationFromNode(
        'User',
        userId,
        'locations',
        locationId,
      );
    } catch (e) {
      throw new ServerException('Could not remove location from user', e);
    }
  }

  async listLocations(
    user: User,
    input: LocationListInput,
  ): Promise<SecuredLocationList> {
    return await this.locationService.listLocationForResource(
      this.privileges.for(User, user).forEdge('locations'),
      user,
      input,
    );
  }

  async createKnownLanguage(args: ModifyKnownLanguageArgs) {
    await this.knownLanguages.create(args);
  }

  async deleteKnownLanguage(args: ModifyKnownLanguageArgs) {
    await this.knownLanguages.delete(args);
  }

  async listKnownLanguages(userId: ID) {
    const user = await this.userRepo.readOne(userId);
    const perms = this.privileges.for(User, user).all.knownLanguage;
    if (!perms.read) {
      return [];
    }
    return await this.knownLanguages.list(userId);
  }

  async checkEmail(email: string): Promise<boolean> {
    const exists = await this.userRepo.doesEmailAddressExist(email);
    return !exists;
  }

  async getUserByEmailAddress(email: string) {
    const user = await this.userRepo.getUserByEmailAddress(email);
    return user ? this.secure(user) : null;
  }

  async assignOrganizationToUser(request: AssignOrganizationToUser) {
    await this.userRepo.assignOrganizationToUser(request);
  }

  async removeOrganizationFromUser(
    request: RemoveOrganizationFromUser,
  ): Promise<void> {
    await this.userRepo.removeOrganizationFromUser(request);
  }
}
