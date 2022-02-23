import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { compact, difference } from 'lodash';
import {
  DuplicateException,
  ID,
  isIdLike,
  mapFromList,
  NotFoundException,
  ObjectView,
  SecuredList,
  SecuredProps,
  SecuredResource,
  ServerException,
  Session,
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
import { Role } from '../authorization';
import {
  AuthorizationService,
  PermissionsOf,
} from '../authorization/authorization.service';
import { Powers } from '../authorization/dto/powers';
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

export const fullName = (
  user: Partial<
    Pick<
      User,
      'realFirstName' | 'realLastName' | 'displayFirstName' | 'displayLastName'
    >
  >
) => {
  const realName = compact([
    user.realFirstName?.value ?? '',
    user.realLastName?.value ?? '',
  ]).join(' ');
  if (realName) {
    return realName;
  }
  const displayName = compact([
    user.displayFirstName?.value ?? '',
    user.displayLastName?.value ?? '',
  ]).join(' ');
  if (displayName) {
    return displayName;
  }

  return undefined;
};

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
      await this.authorizationService.checkPower(Powers.GrantRole, session);
    }

    const id = await this.userRepo.create(input);
    return id;
  }

  @HandleIdLookup(User)
  async readOne(
    id: ID,
    sessionOrUserId: Session | ID,
    _view?: ObjectView
  ): Promise<User> {
    const user = await this.userRepo.readOne(id, sessionOrUserId);
    return await this.secure(user, sessionOrUserId);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const users = await this.userRepo.readMany(ids, session);
    return await Promise.all(users.map((dto) => this.secure(dto, session)));
  }

  async secure(
    user: UnsecuredDto<User>,
    sessionOrUserId: Session | ID
  ): Promise<User> {
    const requestingUserId = isIdLike(sessionOrUserId)
      ? sessionOrUserId
      : sessionOrUserId.userId;

    // let the user explicitly see all properties only if they're reading their own ID
    // TODO: express this within the authorization system. Like an Owner/Creator "meta" role that gets these x permissions.
    const securedProps =
      user.id === requestingUserId
        ? (mapFromList(User.SecuredProps, (key) => [
            key,
            { canRead: true, canEdit: true, value: user[key] },
          ]) as SecuredProps<User>)
        : await this.authorizationService.secureProperties(
            User,
            user,
            sessionOrUserId
          );

    return {
      ...user,
      ...securedProps,
      roles: {
        ...securedProps.roles,
        canEdit: isIdLike(sessionOrUserId)
          ? false
          : await this.authorizationService.hasPower(
              sessionOrUserId,
              Powers.GrantRole
            ),
        value: securedProps.roles.value ?? [],
      },
      canDelete: await this.userRepo.checkDeletePermission(
        user.id,
        sessionOrUserId
      ),
    };
  }

  @Transactional()
  async update(input: UpdateUser, session: Session): Promise<User> {
    this.logger.debug('mutation update User', { input, session });
    const user = await this.readOne(input.id, session);

    const changes = this.userRepo.getActualChanges(user, input);

    if (user.id !== session.userId) {
      await this.authorizationService.verifyCanEditChanges(User, user, changes);
    }

    const { roles, email, ...simpleChanges } = changes;

    if (roles) {
      await this.authorizationService.checkPower(Powers.GrantRole, session);
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
    if (await this.authorizationService.canList(User, session)) {
      const results = await this.userRepo.list(input, session);
      return await mapListResults(results, (dto) => this.secure(dto, session));
    } else {
      // return a list of one: the person's own user info if can't read others
      const sessionUser = await this.readOne(session.userId, session);
      return {
        items: [sessionUser],
        total: 1,
        hasMore: false,
      };
    }
  }

  async permissionsForListProp(
    prop: keyof PermissionsOf<SecuredResource<typeof User>>,
    session: Session | ID
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
