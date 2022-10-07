import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { difference } from 'lodash';
import {
  CachedOnArg,
  DuplicateException,
  ID,
  NotFoundException,
  ObjectView,
  SecuredList,
  SecuredResource,
  ServerException,
  Session,
  UnauthorizedException,
  UnsecuredDto,
} from '../../common';
import {
  HandleIdLookup,
  ILogger,
  Logger,
  Transactional,
  UniquenessError,
} from '../../core';
import { property } from '../../core/database/query';
import { mapListResults } from '../../core/database/results';
import { Privileges, Role } from '../authorization';
import {
  AuthorizationService,
  PermissionsOf,
} from '../authorization/authorization.service';
import { AssignableRoles } from '../authorization/dto/assignable-roles';
import { LanguageService } from '../language';
import {
  LocationListInput,
  LocationService,
  SecuredLocationList,
} from '../location';
import {
  OrganizationListInput,
  OrganizationService,
  SecuredOrganizationList,
} from '../organization';
import {
  PartnerListInput,
  PartnerService,
  SecuredPartnerList,
} from '../partner';
import {
  AssignOrganizationToUser,
  CreatePerson,
  KnownLanguage,
  RemoveOrganizationFromUser,
  UpdateUser,
  User,
  UserListInput,
  UserListOutput,
} from './dto';
import { LanguageProficiency } from './dto/language-proficiency.enum';
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
import { UserRepository } from './user.repository';

@Injectable()
export class UserService {
  constructor(
    private readonly educations: EducationService,
    private readonly organizations: OrganizationService,
    @Inject(forwardRef(() => PartnerService))
    private readonly partners: PartnerService,
    private readonly unavailabilities: UnavailabilityService,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    private readonly privileges: Privileges,
    private readonly locationService: LocationService,
    private readonly languageService: LanguageService,
    private readonly userRepo: UserRepository,
    @Logger('user:service') private readonly logger: ILogger
  ) {}

  roleProperties = (roles?: Role[]) => {
    return (roles || []).flatMap((role) =>
      property('roles', role, 'user', `role${role}`)
    );
  };

  async create(input: CreatePerson, session?: Session): Promise<ID> {
    if (input.roles && input.roles.length > 0 && session) {
      // Note: session is only omitted for creating RootUser
      this.verifyRolesAreAssignable(session, input.roles);
    }

    const id = await this.userRepo.create(input);
    return id;
  }

  @HandleIdLookup(User)
  async readOne(id: ID, session: Session, _view?: ObjectView): Promise<User> {
    const user = await this.userRepo.readOne(id, session);
    return await this.secure(user, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const users = await this.userRepo.readMany(ids, session);
    return await Promise.all(users.map((dto) => this.secure(dto, session)));
  }

  async secure(user: UnsecuredDto<User>, session: Session): Promise<User> {
    const securedProps = this.privileges
      .for(session, User, user)
      .secureProps(user);

    return {
      ...user,
      ...securedProps,
      canDelete: await this.userRepo.checkDeletePermission(user.id, session),
    };
  }

  @Transactional()
  async update(input: UpdateUser, session: Session): Promise<User> {
    this.logger.debug('mutation update User', { input, session });
    const user = await this.readOne(input.id, session);

    const changes = this.userRepo.getActualChanges(user, input);

    await this.authorizationService.verifyCanEditChanges(User, user, changes);

    const { roles, email, ...simpleChanges } = changes;

    if (roles) {
      this.verifyRolesAreAssignable(session, roles);
    }

    await this.userRepo.updateProperties(user, simpleChanges);

    // Update email
    if (email !== undefined) {
      try {
        await this.userRepo.updateEmail(user, email);
      } catch (e) {
        if (e instanceof UniquenessError && e.label === 'EmailAddress') {
          throw new DuplicateException(
            'person.email',
            'Email address is already in use',
            e
          );
        }
        throw new ServerException('Failed to create user', e);
      }
    }

    // Update roles
    if (roles) {
      const removals = difference(user.roles.value, roles);
      const additions = difference(roles, user.roles.value);
      await this.userRepo.updateRoles(input, removals, additions);
    }

    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find User');
    }
    await this.userRepo.delete(id, session, object);
  }

  async list(input: UserListInput, session: Session): Promise<UserListOutput> {
    const results = await this.userRepo.list(input, session);
    return await mapListResults(results, (dto) => this.secure(dto, session));
  }

  @CachedOnArg()
  getAssignableRoles(session: Session) {
    const privileges = this.privileges.for(session, AssignableRoles);
    const assignableRoles = new Set(
      (Object.keys(Role) as Role[]).filter((role: Role) =>
        privileges.can('edit', role)
      )
    );
    return assignableRoles;
  }

  verifyRolesAreAssignable(session: Session, roles: Role[]) {
    const allowed = this.getAssignableRoles(session);
    const invalid = roles.filter((role) => !allowed.has(role));
    if (invalid.length === 0) {
      return;
    }
    const invalidStr = invalid.join(', ');
    throw new UnauthorizedException(
      `You do not have the permission to assign users the roles: ${invalidStr}`
    );
  }

  async permissionsForListProp(
    prop: keyof PermissionsOf<SecuredResource<typeof User>>,
    session: Session
  ) {
    const perms = await this.authorizationService.getPermissions({
      resource: User,
      sessionOrUserId: session,
    });
    return { ...perms[prop], canCreate: perms[prop].canEdit };
  }

  async listEducations(
    userId: ID,
    input: EducationListInput,
    session: Session
  ): Promise<SecuredEducationList> {
    const perms = await this.permissionsForListProp('education', session);

    if (!perms.canRead) {
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
      session
    );
    return {
      ...result,
      ...perms,
    };
  }

  async listOrganizations(
    userId: ID,
    input: OrganizationListInput,
    session: Session
  ): Promise<SecuredOrganizationList> {
    const perms = await this.permissionsForListProp('organization', session);

    if (!perms.canRead) {
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
      session
    );

    return {
      ...result,
      ...perms,
    };
  }

  async listPartners(
    userId: ID,
    input: PartnerListInput,
    session: Session
  ): Promise<SecuredPartnerList> {
    const perms = await this.permissionsForListProp('partner', session);
    const result = await this.partners.list(
      {
        ...input,
        filter: {
          ...input.filter,
          userId,
        },
      },
      session
    );
    return {
      ...result,
      ...perms,
    };
  }

  async listUnavailabilities(
    userId: ID,
    input: UnavailabilityListInput,
    session: Session
  ): Promise<SecuredUnavailabilityList> {
    const perms = await this.permissionsForListProp('unavailability', session);

    if (!perms.canRead) {
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
      session
    );

    return {
      ...result,
      ...perms,
    };
  }

  async addLocation(
    userId: ID,
    locationId: ID,
    _session: Session
  ): Promise<void> {
    try {
      await this.locationService.addLocationToNode(
        'User',
        userId,
        'locations',
        locationId
      );
    } catch (e) {
      throw new ServerException('Could not add location to user', e);
    }
  }

  async removeLocation(
    userId: ID,
    locationId: ID,
    _session: Session
  ): Promise<void> {
    try {
      await this.locationService.removeLocationFromNode(
        'User',
        userId,
        'locations',
        locationId
      );
    } catch (e) {
      throw new ServerException('Could not remove location from user', e);
    }
  }

  async listLocations(
    user: User,
    input: LocationListInput,
    session: Session
  ): Promise<SecuredLocationList> {
    return await this.locationService.listLocationForResource(
      User,
      user,
      'locations',
      input,
      session
    );
  }

  async createKnownLanguage(
    userId: ID,
    languageId: ID,
    languageProficiency: LanguageProficiency,
    _session: Session
  ): Promise<void> {
    try {
      await this.deleteKnownLanguage(
        userId,
        languageId,
        languageProficiency,
        _session
      );
      await this.userRepo.createKnownLanguage(
        userId,
        languageId,
        languageProficiency
      );
    } catch (e) {
      throw new ServerException('Could not create known language', e);
    }
  }

  async deleteKnownLanguage(
    userId: ID,
    languageId: ID,
    languageProficiency: LanguageProficiency,
    _session: Session
  ): Promise<void> {
    try {
      await this.userRepo.deleteKnownLanguage(
        userId,
        languageId,
        languageProficiency
      );
    } catch (e) {
      throw new ServerException('Could not delete known language', e);
    }
  }

  async listKnownLanguages(
    userId: ID,
    session: Session
  ): Promise<readonly KnownLanguage[]> {
    const perms = await this.permissionsForListProp('knownLanguage', session);
    if (!perms.canRead) {
      return [];
    }
    return await this.userRepo.listKnownLanguages(userId, session);
  }

  async checkEmail(email: string): Promise<boolean> {
    const exists = await this.userRepo.doesEmailAddressExist(email);
    return !exists;
  }

  async assignOrganizationToUser(
    request: AssignOrganizationToUser,
    _session: Session
  ) {
    await this.userRepo.assignOrganizationToUser(request);
  }

  async removeOrganizationFromUser(
    request: RemoveOrganizationFromUser,
    _session: Session
  ): Promise<void> {
    await this.userRepo.removeOrganizationFromUser(request);
  }
}
