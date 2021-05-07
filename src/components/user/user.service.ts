import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { inArray, node, relation } from 'cypher-query-builder';
import { compact, difference } from 'lodash';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  generateId,
  ID,
  isIdLike,
  mapFromList,
  NotFoundException,
  SecuredList,
  SecuredResource,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../common';
import {
  ConfigService,
  DatabaseService,
  deleteProperties,
  ILogger,
  Logger,
  matchSession,
  OnIndex,
  property,
  Transactional,
  UniquenessError,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  parseSecuredProperties,
  runListQuery,
  StandardReadResult,
} from '../../core/database/results';
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
import { DbUser } from './model';
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
    // private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    private readonly locationService: LocationService,
    private readonly languageService: LanguageService,
    private readonly userRepo: UserRepository,
    @Logger('user:service') private readonly logger: ILogger
  ) {}

  @OnIndex()
  async createIndexes() {
    // language=Cypher (for webstorm)
    return [
      // USER NODE
      'CREATE CONSTRAINT ON (n:User) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:User) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:User) ASSERT EXISTS(n.createdAt)',

      // EMAIL REL
      'CREATE CONSTRAINT ON ()-[r:email]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:email]-() ASSERT EXISTS(r.createdAt)',

      // EMAIL NODE
      'CREATE CONSTRAINT ON (n:EmailAddress) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:EmailAddress) ASSERT n.value IS UNIQUE',

      // PASSWORD REL
      'CREATE CONSTRAINT ON ()-[r:password]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:password]-() ASSERT EXISTS(r.createdAt)',
    ];
  }

  roleProperties = (roles?: Role[]) => {
    return (roles || []).flatMap((role) =>
      property('roles', role, 'user', `role${role}`)
    );
  };

  async create(input: CreatePerson, _session?: Session): Promise<ID> {
    const id = await generateId();
    await this.userRepo.create(id, input);
    input.roles &&
      (await this.authorizationService.roleAddedToUser(id, input.roles));
    const dbUser = new DbUser();
    await this.authorizationService.processNewBaseNode(dbUser, id, id);
    return id;
  }

  async readOne(id: ID, sessionOrUserId: Session | ID): Promise<User> {
    const { result, canDelete } = await this.userRepo.readOne(
      id,
      sessionOrUserId
    );
    if (!result) {
      throw new NotFoundException('Could not find user', 'user.id');
    }

    const rolesValue = result.propList
      .filter((prop: any) => prop.property === 'roles')
      .map((prop: any) => prop.value as Role);

    let permsOfBaseNode: PermissionsOf<SecuredResource<typeof User, false>>;
    // -- let the user explicitly see all properties only if they're reading their own ID
    // -- TODO: express this within the authorization system. Like an Owner/Creator "meta" role that gets these x permissions.
    const userId = isIdLike(sessionOrUserId)
      ? sessionOrUserId
      : sessionOrUserId.userId;
    if (id === userId) {
      const implicitPerms = { canRead: true, canEdit: true };
      permsOfBaseNode = mapFromList(User.SecuredProps, (key) => [
        key,
        implicitPerms,
      ]);
    } else {
      permsOfBaseNode = await this.authorizationService.getPermissions(
        User,
        sessionOrUserId
      );
    }

    const securedProps = parseSecuredProperties(
      result.propList,
      permsOfBaseNode,
      User.SecuredProps
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...securedProps,
      roles: {
        ...securedProps.roles,
        value: rolesValue,
      },
      canDelete,
    };
  }

  @Transactional()
  async update(input: UpdateUser, session: Session): Promise<User> {
    // this.logger.debug('mutation update User', { input, session });
    // const user = await this.readOne(input.id, session);
    // await this.userRepo.update(input, user, session);
    // return await this.readOne(input.id, session);
    this.logger.debug('mutation update User', { input, session });
    const user = await this.readOne(input.id, session);
    // const changes = this.db.getActualChanges(User, user, input);

    const changes = this.userRepo.getActualChanges(input, user);

    if (user.id !== session.userId) {
      await this.authorizationService.verifyCanEditChanges(User, user, changes);
    }

    const { roles, email, ...simpleChanges } = changes;

    if (roles) {
      await this.authorizationService.checkPower(Powers.GrantRole, session);
    }

    // await this.db.updateProperties({
    //   type: User,
    //   object: user,
    //   changes: simpleChanges,
    // });
    await this.userRepo.updateProperties(user, simpleChanges);

    // Update email
    if (email) {
      // Remove old emails and relations
      // await this.db
      //   .query()
      //   .match([node('node', ['User', 'BaseNode'], { id: user.id })])
      //   .apply(deleteProperties(User, 'email'))
      //   .return('*')
      //   .run();

      try {
        const createdAt = DateTime.local();
        await this.userRepo.updateEmail(user, email, createdAt);
        // await this.db
        //   .query()
        //   .match([node('user', ['User', 'BaseNode'], { id: user.id })])
        //   .create([
        //     node('user'),
        //     relation('out', '', 'email', {
        //       active: true,
        //       createdAt,
        //     }),
        //     node('email', 'EmailAddress:Property', {
        //       value: email,
        //       createdAt,
        //     }),
        //   ])
        //   .run();
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
      // if (removals.length > 0) {
      //   await this.db
      //     .query()
      //     .match([
      //       node('user', ['User', 'BaseNode'], {
      //         id: input.id,
      //       }),
      //       relation('out', 'oldRoleRel', 'roles', { active: true }),
      //       node('oldRoles', 'Property'),
      //     ])
      //     .where({
      //       oldRoles: {
      //         value: inArray(removals),
      //       },
      //     })
      //     .set({
      //       values: {
      //         'oldRoleRel.active': false,
      //       },
      //     })
      //     .run();
      // }

      // if (additions.length > 0) {
      //   await this.db
      //     .query()
      //     .match([
      //       node('user', ['User', 'BaseNode'], {
      //         id: input.id,
      //       }),
      //     ])
      //     .create([...this.roleProperties(additions)])
      //     .run();
      // }
      await this.authorizationService.roleAddedToUser(input.id, roles);
    }

    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    //object should be renamed to user?
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find User');
    }
    this.userRepo.delete(id, session, object);

    // const canDelete = await this.db.checkDeletePermission(id, session);

    // if (!canDelete)
    //   throw new UnauthorizedException(
    //     'You do not have the permission to delete this User'
    //   );

    // try {
    //   await this.db.deleteNode(object);
    // } catch (exception) {
    //   this.logger.error('Failed to delete', { id, exception });
    //   throw new ServerException('Failed to delete', exception);
    // }
  }

  async list(input: UserListInput, session: Session): Promise<UserListOutput> {
    // const query = this.db
    //   .query()
    //   .match([requestingUser(session), ...permissionsOfNode('User')])
    //   .apply(calculateTotalAndPaginateList(User, input));
    const query = this.userRepo.list(input, session);
    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }

  async listEducations(
    userId: ID,
    input: EducationListInput,
    session: Session
  ): Promise<SecuredEducationList> {
    // const query = this.db
    //   .query()
    //   .match(matchSession(session)) // Michel Query Refactor Will Fix This
    //   .match([node('user', 'User', { id: userId })])
    //   .optionalMatch([
    //     node('requestingUser'),
    //     relation('in', 'memberOfReadSecurityGroup', 'member'),
    //     node('readSecurityGroup', 'SecurityGroup'),
    //     relation('out', 'sgReadPerms', 'permission'),
    //     node('canRead', 'Permission', {
    //       property: 'education',
    //       read: true,
    //     }),
    //     relation('out', 'readPermsOfBaseNode', 'baseNode'),
    //     node('user'),
    //   ])
    //   .optionalMatch([
    //     node('requestingUser'),
    //     relation('in', 'memberOfEditSecurityGroup', 'member'),
    //     node('editSecurityGroup', 'SecurityGroup'),
    //     relation('out', 'sgEditPerms', 'permission'),
    //     node('canEdit', 'Permission', {
    //       property: 'education',
    //       edit: true,
    //     }),
    //     relation('out', 'editPermsOfBaseNode', 'baseNode'),
    //     node('user'),
    //   ])
    //   .return({
    //     canRead: [{ read: 'canRead' }],
    //     canEdit: [{ edit: 'canEdit' }],
    //   });

    const query = this.userRepo.listEducations(userId, session);

    let user;
    try {
      user = await query.first();
    } catch (exception) {
      this.logger.error(`Could not find education`, {
        exception,
        userId: session.userId,
      });
      throw new ServerException('Could not find education', exception);
    }
    if (!user) {
      throw new NotFoundException('Could not find user', 'userId');
    }
    if (!user.canRead) {
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
      canRead: user.canRead,
      canCreate: user.canEdit ?? false,
    };
  }

  async listOrganizations(
    userId: ID,
    input: OrganizationListInput,
    session: Session
  ): Promise<SecuredOrganizationList> {
    // const query = this.db
    //   .query()
    //   .match(matchSession(session))
    //   .match([node('user', 'User', { id: userId })])
    //   .optionalMatch([
    //     node('requestingUser'),
    //     relation('in', 'memberOfReadSecurityGroup', 'member'),
    //     node('readSecurityGroup', 'SecurityGroup'),
    //     relation('out', 'sgReadPerms', 'permission'),
    //     node('canRead', 'Permission', {
    //       property: 'organization',
    //       read: true,
    //     }),
    //     relation('out', 'readPermsOfBaseNode', 'baseNode'),
    //     node('user'),
    //   ])
    //   .optionalMatch([
    //     node('requestingUser'),
    //     relation('in', 'memberOfEditSecurityGroup', 'member'),
    //     node('editSecurityGroup', 'SecurityGroup'),
    //     relation('out', 'sgEditPerms', 'permission'),
    //     node('canEdit', 'Permission', {
    //       property: 'organization',
    //       edit: true,
    //     }),
    //     relation('out', 'editPermsOfBaseNode', 'baseNode'),
    //     node('user'),
    //   ])
    //   .return({
    //     canRead: [{ read: 'canRead' }],
    //     canEdit: [{ edit: 'canEdit' }],
    //   });
    const query = this.userRepo.listOrganizations(userId, session);
    let user;
    try {
      user = await query.first();
    } catch (exception) {
      this.logger.error(`Could not find organizations`, {
        exception,
        userId: session.userId,
      });
      throw new ServerException('Could not find organization', exception);
    }
    if (!user) {
      throw new NotFoundException('Could not find user', 'userId');
    }
    if (!user.canRead) {
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
      canRead: user.canRead,
      canCreate: user.canEdit ?? false,
    };
  }

  async listPartners(
    userId: ID,
    input: PartnerListInput,
    session: Session
  ): Promise<SecuredPartnerList> {
    // const query = this.db
    //   .query()
    //   .match(matchSession(session)) // Michel Query Refactor Will Fix This
    //   .match([node('user', 'User', { id: userId })])
    //   .optionalMatch([
    //     node('requestingUser'),
    //     relation('in', 'memberOfReadSecurityGroup', 'member'),
    //     node('readSecurityGroup', 'SecurityGroup'),
    //     relation('out', 'sgReadPerms', 'permission'),
    //     node('canRead', 'Permission', {
    //       property: 'partners',
    //       read: true,
    //     }),
    //     relation('out', 'readPermsOfBaseNode', 'baseNode'),
    //     node('user'),
    //   ])
    //   .optionalMatch([
    //     node('requestingUser'),
    //     relation('in', 'memberOfEditSecurityGroup', 'member'),
    //     node('editSecurityGroup', 'SecurityGroup'),
    //     relation('out', 'sgEditPerms', 'permission'),
    //     node('canEdit', 'Permission', {
    //       property: 'partners',
    //       edit: true,
    //     }),
    //     relation('out', 'editPermsOfBaseNode', 'baseNode'),
    //     node('user'),
    //   ])
    //   .return({
    //     canRead: [{ read: 'canRead' }],
    //     canEdit: [{ edit: 'canEdit' }],
    //   });
    const query = this.userRepo.listPartners(userId, session);
    let user;
    try {
      user = await query.first();
    } catch (exception) {
      this.logger.error(`Could not find partners`, {
        exception,
        userId: session.userId,
      });
      throw new ServerException('Could not find partner', exception);
    }
    if (!user) {
      throw new NotFoundException('Could not find user', 'userId');
    }

    if (!user.canRead) {
      this.logger.warning('Cannot read partner list', {
        userId,
      });
      return SecuredList.Redacted;
    }
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
      canRead: user.canRead,
      canCreate: user.canEdit,
    };
  }

  async listUnavailabilities(
    userId: ID,
    input: UnavailabilityListInput,
    session: Session
  ): Promise<SecuredUnavailabilityList> {
    // const query = this.db
    //   .query()
    //   .match(matchSession(session))
    //   .match([node('user', 'User', { id: userId })])
    //   .optionalMatch([
    //     node('requestingUser'),
    //     relation('in', 'memberOfReadSecurityGroup', 'member'),
    //     node('readSecurityGroup', 'SecurityGroup'),
    //     relation('out', 'sgReadPerms', 'permission'),
    //     node('canRead', 'Permission', {
    //       property: 'unavailability',
    //       read: true,
    //     }),
    //     relation('out', 'readPermsOfBaseNode', 'baseNode'),
    //     node('user'),
    //   ])
    //   .optionalMatch([
    //     node('requestingUser'),
    //     relation('in', 'memberOfEditSecurityGroup', 'member'),
    //     node('editSecurityGroup', 'SecurityGroup'),
    //     relation('out', 'sgEditPerms', 'permission'),
    //     node('canEdit', 'Permission', {
    //       property: 'unavailability',
    //       edit: true,
    //     }),
    //     relation('out', 'editPermsOfBaseNode', 'baseNode'),
    //     node('user'),
    //   ])
    //   .return({
    //     canRead: [{ read: 'canRead' }],
    //     canEdit: [{ edit: 'canEdit' }],
    //   });
    const query = this.userRepo.listUnavailabilities(userId, session);
    let user;
    try {
      user = await query.first();
    } catch (exception) {
      this.logger.error(`Could not find unavailability`, {
        exception,
        userId: session.userId,
      });
      throw new ServerException('Could not find unavailability', exception);
    }
    if (!user) {
      throw new NotFoundException('Could not find user', 'userId');
    }
    if (!user.canRead) {
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
      canRead: user.canRead,
      canCreate: user.canEdit ?? false,
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
    userId: ID,
    input: LocationListInput,
    session: Session
  ): Promise<SecuredLocationList> {
    return await this.locationService.listLocationsFromNode(
      'User',
      userId,
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
      // await this.db
      //   .query()
      //   .matchNode('user', 'User', { id: userId })
      //   .matchNode('language', 'Language', { id: languageId })
      //   .create([
      //     node('user'),
      //     relation('out', '', 'knownLanguage', {
      //       active: true,
      //       createdAt: DateTime.local(),
      //       value: languageProficiency,
      //     }),
      //     node('language'),
      //   ])
      //   .run();
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
  ): Promise<KnownLanguage[]> {
    // const results = await this.db
    //   .query()
    //   .match([
    //     requestingUser(session),
    //     ...permissionsOfNode('Language'),
    //     relation('in', 'knownLanguageRel', 'knownLanguage', { active: true }),
    //     node('user', 'User', { id: userId }),
    //   ])
    //   .with('collect(distinct user) as users, node, knownLanguageRel')
    //   .raw(`unwind users as user`)
    //   .return([
    //     'knownLanguageRel.value as languageProficiency',
    //     'node.id as languageId',
    //   ])
    //   .asResult<{
    //     languageProficiency: LanguageProficiency;
    //     languageId: ID;
    //   }>()
    //   .run();
    const results = await this.userRepo.listKnownLanguages(userId, session);

    const knownLanguages = await Promise.all(
      results.map(async (item: any) => {
        return {
          language: item.languageId,
          proficiency: item.languageProficiency,
        };
      })
    );

    return knownLanguages as KnownLanguage[];
  }

  async checkEmail(email: string): Promise<boolean> {
    const result = this.userRepo.checkEmail(email);
    if (result) {
      return false;
    }
    return true;
  }

  async assignOrganizationToUser(
    request: AssignOrganizationToUser,
    session: Session
  ): Promise<void> {
    //TO DO: Refactor session in the future

    // const querySession = this.db.query();
    // if (session.userId) {
    //   querySession.match([
    //     matchSession(session, { withAclEdit: 'canCreateOrg' }),
    //   ]);
    // }

    // const primary =
    //   request.primary !== null && request.primary !== undefined
    //     ? request.primary
    //     : false;

    // //2
    // await this.db
    //   .query()
    //   .match([
    //     node('user', 'User', {
    //       id: request.userId,
    //     }),
    //     relation('out', 'oldRel', 'organization', {
    //       active: true,
    //     }),
    //     node('primaryOrg', 'Organization', {
    //       id: request.orgId,
    //     }),
    //   ])
    //   .setValues({ 'oldRel.active': false })
    //   .return('oldRel')
    //   .first();

    // if (primary) {
    //   await this.db
    //     .query()
    //     .match([
    //       node('user', 'User', {
    //         id: request.userId,
    //       }),
    //       relation('out', 'oldRel', 'primaryOrganization', {
    //         active: true,
    //       }),
    //       node('primaryOrg', 'Organization', {
    //         id: request.orgId,
    //       }),
    //     ])
    //     .setValues({ 'oldRel.active': false })
    //     .return('oldRel')
    //     .first();
    // }
    // //3
    // let queryCreate;
    // if (primary) {
    //   queryCreate = this.db.query().raw(
    //     `
    //     MATCH (primaryOrg:Organization {id: $orgId}),
    //     (user:User {id: $userId})
    //     CREATE (primaryOrg)<-[:primaryOrganization {active: true, createdAt: datetime()}]-(user),
    //     (primaryOrg)<-[:organization {active: true, createdAt: datetime()}]-(user)
    //     RETURN  user.id as id
    //   `,
    //     {
    //       userId: request.userId,
    //       orgId: request.orgId,
    //     }
    //   );
    // } else {
    //   queryCreate = this.db.query().raw(
    //     `
    //     MATCH (org:Organization {id: $orgId}),
    //     (user:User {id: $userId})
    //     CREATE (org)<-[:organization {active: true, createdAt: datetime()}]-(user)
    //     RETURN  user.id as id
    //   `,
    //     {
    //       userId: request.userId,
    //       orgId: request.orgId,
    //     }
    //   );
    // }
    const queryCreate = await this.userRepo.assignOrganizationToUser(
      request,
      session
    );
    const result = await queryCreate.first();
    if (!result) {
      throw new ServerException('Failed to assign organzation to user');
    }
  }

  async removeOrganizationFromUser(
    request: RemoveOrganizationFromUser,
    _session: Session
  ): Promise<void> {
    // const removeOrg = this.db
    //   .query()
    //   .match([
    //     node('user', 'User', {
    //       id: request.userId,
    //     }),
    //     relation('out', 'oldRel', 'organization', {
    //       active: true,
    //     }),
    //     node('org', 'Organization', {
    //       id: request.orgId,
    //     }),
    //   ])
    //   .optionalMatch([
    //     node('user'),
    //     relation('out', 'primary', 'primaryOrganization', { active: true }),
    //     node('org'),
    //   ])
    //   .setValues({ 'oldRel.active': false })
    //   .return({ oldRel: [{ id: 'oldId' }], primary: [{ id: 'primaryId' }] });
    // let resultOrg;
    // try {
    //   resultOrg = await removeOrg.first();
    // } catch (e) {
    //   throw new NotFoundException('user and org are not connected');
    // }

    // if (resultOrg?.primaryId) {
    //   const removePrimary = this.db
    //     .query()
    //     .match([
    //       node('user', 'User', {
    //         id: request.userId,
    //       }),
    //       relation('out', 'oldRel', 'primaryOrganization', {
    //         active: true,
    //       }),
    //       node('primaryOrg', 'Organization', {
    //         id: request.orgId,
    //       }),
    //     ])
    //     .setValues({ 'oldRel.active': false })
    //     .return('oldRel');
    //   try {
    //     await removePrimary.first();
    //   } catch {
    //     this.logger.debug('not primary');
    //   }
    // }
    const resultOrg = await this.userRepo.removeOrganizationFromUser(request);

    if (!resultOrg) {
      throw new ServerException('Failed to assign organzation to user');
    }
  }

  async checkUserConsistency(session: Session): Promise<boolean> {
    const users = await this.userRepo.getUsers(session);
    return (
      (
        await Promise.all(
          users.map(async (user) => {
            return await this.userRepo.checkUserProperties(session, user);
          })
        )
      ).every((n) => n) &&
      (
        await Promise.all(
          users.map(async (user) => {
            // return await this.db.isUniqueProperties({
            //   session,
            //   id: user.id,
            //   props: [
            //     'email',
            //     'realFirstName',
            //     'realLastName',
            //     'displayFirstName',
            //     'displayLastName',
            //     'phone',
            //     'timezone',
            //     'about',
            //   ],
            //   nodevar: 'user',
            // });
            return await this.userRepo.checkUniqueProperties(session, user);
          })
        )
      ).every((n) => n)
    );
  }
}
