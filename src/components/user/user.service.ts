import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { CachedByArg } from '@seedcompany/common';
import {
  ID,
  ObjectView,
  Role,
  SecuredList,
  ServerException,
  Session,
  UnauthorizedException,
  UnsecuredDto,
} from '~/common';
import { HandleIdLookup, ILogger, Logger } from '~/core';
import { Transactional } from '~/core/database';
import { property } from '~/core/database/query';
import { Privileges } from '../authorization';
import { AssignableRoles } from '../authorization/dto/assignable-roles';
import { LocationService } from '../location';
import { LocationListInput, SecuredLocationList } from '../location/dto';
import { OrganizationService } from '../organization';
import {
  OrganizationListInput,
  SecuredOrganizationList,
} from '../organization/dto';
import { PartnerService } from '../partner';
import { PartnerListInput, SecuredPartnerList } from '../partner/dto';
import {
  AssignOrganizationToUser,
  CreatePerson,
  ModifyKnownLanguageArgs,
  RemoveOrganizationFromUser,
  SystemAgent,
  UpdateUser,
  User,
  UserListInput,
  UserListOutput,
} from './dto';
import { EducationService } from './education';
import { EducationListInput, SecuredEducationList } from './education/dto';
import { KnownLanguageRepository } from './known-language.repository';
import { UnavailabilityService } from './unavailability';
import {
  SecuredUnavailabilityList,
  UnavailabilityListInput,
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
    private readonly userRepo: UserRepository,
    @Logger('user:service') private readonly logger: ILogger,
  ) {}

  roleProperties = (roles?: Role[]) => {
    return (roles || []).flatMap((role) =>
      property('roles', role, 'user', `role${role}`),
    );
  };

  async create(input: CreatePerson, session?: Session): Promise<ID> {
    if (input.roles && input.roles.length > 0 && session) {
      // Note: session is only omitted for creating RootUser
      this.verifyRolesAreAssignable(session, input.roles);
    }

    const { id } = await this.userRepo.create(input);
    return id;
  }

  @HandleIdLookup(User)
  async readOne(id: ID, session: Session, _view?: ObjectView): Promise<User> {
    const user = await this.userRepo.readOne(id, session);
    return this.secure(user, session);
  }

  async readOneUnsecured(
    id: ID,
    session: Session | ID,
  ): Promise<UnsecuredDto<User>> {
    return await this.userRepo.readOne(id, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const users = await this.userRepo.readMany(ids, session);
    return users.map((dto) => this.secure(dto, session));
  }

  async readManyActors(
    ids: readonly ID[],
    session: Session,
  ): Promise<ReadonlyArray<User | SystemAgent>> {
    const users = await this.userRepo.readManyActors(ids, session);
    return users.map((dto) =>
      dto.__typename === 'User'
        ? this.secure(dto, session)
        : (dto as SystemAgent),
    );
  }

  secure(user: UnsecuredDto<User>, session: Session): User {
    return this.privileges.for(session, User).secure(user);
  }

  @Transactional()
  async update(input: UpdateUser, session: Session): Promise<User> {
    this.logger.debug('mutation update User', { input, session });
    const user = await this.readOne(input.id, session);

    const changes = this.userRepo.getActualChanges(user, input);

    this.privileges.for(session, User, user).verifyChanges(changes);

    if (changes.roles) {
      this.verifyRolesAreAssignable(session, changes.roles);
    }

    const updated = await this.userRepo.update({
      id: user.id,
      ...changes,
    });
    return this.secure(updated, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);
    await this.userRepo.delete(id, session, object);
  }

  async list(input: UserListInput, session: Session): Promise<UserListOutput> {
    const results = await this.userRepo.list(input, session);
    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto, session)),
    };
  }

  @CachedByArg({ weak: true })
  getAssignableRoles(session: Session) {
    const privileges = this.privileges.for(session, AssignableRoles);
    const assignableRoles = new Set(
      [...Role].filter((role) => privileges.can('edit', role)),
    );
    return assignableRoles;
  }

  verifyRolesAreAssignable(session: Session, roles: readonly Role[]) {
    const allowed = this.getAssignableRoles(session);
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
    session: Session,
  ): Promise<SecuredEducationList> {
    const user = await this.userRepo.readOne(userId, session);
    const perms = this.privileges.for(session, User, user).all.education;

    if (!perms.read) {
      return SecuredList.Redacted;
    }
    const result = await this.educations.list(
      {
        ...input,
        filter: {
          ...input.filter,
          userId: userId,
        },
      },
      session,
    );
    return {
      ...result,
      canRead: perms.read,
      canCreate: perms.create,
    };
  }

  async listOrganizations(
    userId: ID,
    input: OrganizationListInput,
    session: Session,
  ): Promise<SecuredOrganizationList> {
    const user = await this.userRepo.readOne(userId, session);
    const perms = this.privileges.for(session, User, user).all.organization;

    if (!perms.read) {
      return SecuredList.Redacted;
    }
    const result = await this.organizations.list(
      {
        ...input,
        filter: {
          ...input.filter,
          userId: userId,
        },
      },
      session,
    );
    return {
      ...result,
      canRead: perms.read,
      canCreate: perms.edit,
    };
  }

  async listPartners(
    userId: ID,
    input: PartnerListInput,
    session: Session,
  ): Promise<SecuredPartnerList> {
    const user = await this.userRepo.readOne(userId, session);
    const perms = this.privileges.for(session, User, user).all.partner;
    const result = await this.partners.list(
      {
        ...input,
        filter: {
          ...input.filter,
          userId,
        },
      },
      session,
    );
    return {
      ...result,
      canRead: perms.read,
      canCreate: perms.edit,
    };
  }

  async listUnavailabilities(
    userId: ID,
    input: UnavailabilityListInput,
    session: Session,
  ): Promise<SecuredUnavailabilityList> {
    const user = await this.userRepo.readOne(userId, session);
    const perms = this.privileges.for(session, User, user).all.unavailability;

    if (!perms.read) {
      return SecuredList.Redacted;
    }
    const result = await this.unavailabilities.list(
      {
        ...input,
        filter: {
          ...input.filter,
          userId: userId,
        },
      },
      session,
    );

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
    session: Session,
  ): Promise<SecuredLocationList> {
    return await this.locationService.listLocationForResource(
      this.privileges.for(session, User, user).forEdge('locations'),
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

  async listKnownLanguages(userId: ID, session: Session) {
    const user = await this.userRepo.readOne(userId, session);
    const perms = this.privileges.for(session, User, user).all.knownLanguage;
    if (!perms.read) {
      return [];
    }
    return await this.knownLanguages.list(userId);
  }

  async checkEmail(email: string): Promise<boolean> {
    const exists = await this.userRepo.doesEmailAddressExist(email);
    return !exists;
  }

  async getUserByEmailAddress(email: string, session: Session) {
    const user = await this.userRepo.getUserByEmailAddress(email, session);
    return user ? this.secure(user, session) : null;
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
