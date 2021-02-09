import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { compact } from 'lodash';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  generateId,
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
  ILogger,
  Logger,
  matchSession,
  OnIndex,
  property,
  setPropLabelsAndValuesDeleted,
  Transactional,
  UniquenessError,
  UniqueProperties,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  defaultSorter,
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
  private readonly securedProperties = {
    email: true,
    realFirstName: true,
    realLastName: true,
    displayFirstName: true,
    displayLastName: true,
    phone: true,
    timezone: true,
    about: true,
    status: true,
    title: true,
    roles: true,
  };

  constructor(
    private readonly educations: EducationService,
    private readonly organizations: OrganizationService,
    @Inject(forwardRef(() => PartnerService))
    private readonly partners: PartnerService,
    private readonly unavailabilities: UnavailabilityService,
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    private readonly locationService: LocationService,
    private readonly languageService: LanguageService,
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

  @Transactional()
  async create(input: CreatePerson, _session?: Session): Promise<string> {
    const id = await generateId();
    const createdAt = DateTime.local();

    const query = this.db.query();
    query.create([
      [
        node('user', ['User', 'BaseNode'], {
          id,
          createdAt,
        }),
      ],
      ...property('email', input.email, 'user', 'email', 'EmailAddress'),
      ...property('realFirstName', input.realFirstName, 'user'),
      ...property('realLastName', input.realLastName, 'user'),
      ...property('displayFirstName', input.displayFirstName, 'user'),
      ...property('displayLastName', input.displayLastName, 'user'),
      ...property('phone', input.phone, 'user'),
      ...property('timezone', input.timezone, 'user'),
      ...property('about', input.about, 'user'),
      ...property('status', input.status, 'user'),
      ...this.roleProperties(input.roles),
      ...property('title', input.title, 'user'),
      ...property('canDelete', true, 'user'),
    ]);

    query.return({
      user: [{ id: 'id' }],
    });
    let result;
    try {
      result = await query.first();
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
    if (!result) {
      throw new ServerException('Failed to create user');
    }

    // attach user to publicSG

    const attachUserToPublicSg = await this.db
      .query()
      .match(node('user', 'User', { id }))
      .match(node('publicSg', 'PublicSecurityGroup'))

      .create([node('publicSg'), relation('out', '', 'member'), node('user')])
      .create([
        node('publicSg'),
        relation('out', '', 'permission'),
        node('', 'Permission', {
          property: 'displayFirstName',
          read: true,
        }),
        relation('out', '', 'baseNode'),
        node('user'),
      ])
      .create([
        node('publicSg'),
        relation('out', '', 'permission'),
        node('', 'Permission', {
          property: 'displayLastName',
          read: true,
        }),
        relation('out', '', 'baseNode'),
        node('user'),
      ])
      .return('user')
      .first();

    if (!attachUserToPublicSg) {
      this.logger.error('failed to attach user to public securityGroup');
    }

    if (this.config.defaultOrg.id) {
      const attachToOrgPublicSg = await this.db
        .query()
        .match(node('user', 'User', { id }))
        .match([
          node('orgPublicSg', 'OrgPublicSecurityGroup'),
          relation('out', '', 'organization'),
          node('defaultOrg', 'Organization', {
            id: this.config.defaultOrg.id,
          }),
        ])
        .create([
          node('user'),
          relation('in', '', 'member'),
          node('orgPublicSg'),
        ])
        .run();

      if (attachToOrgPublicSg) {
        //
      }
    }
    input.roles &&
      (await this.authorizationService.roleAddedToUser(id, input.roles));

    const dbUser = new DbUser();
    await this.authorizationService.processNewBaseNode(dbUser, id, id);

    return result.id;
  }

  @Transactional()
  async readOne(id: string, sessionOrUserId: Session | string): Promise<User> {
    const query = this.db
      .query()
      .match([node('node', 'User', { id })])
      .call(matchPropList)
      .return('propList, node')
      .asResult<StandardReadResult<DbPropsOfDto<User>>>();

    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find user', 'user.id');
    }

    const rolesValue = result.propList
      .filter((prop) => prop.property === 'roles')
      .map((prop) => prop.value as Role);

    let permsOfBaseNode: PermissionsOf<SecuredResource<typeof User, false>>;
    // -- let the user explicitly see all properties only if they're reading their own ID
    // -- TODO: express this within the authorization system. Like an Owner/Creator "meta" role that gets these x permissions.
    const userId =
      typeof sessionOrUserId === 'string'
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
      canDelete: await this.db.checkDeletePermission(id, sessionOrUserId),
    };
  }

  @Transactional()
  async update(input: UpdateUser, session: Session): Promise<User> {
    this.logger.debug('mutation update User', { input, session });
    const user = await this.readOne(input.id, session);

    await this.db.sgUpdateProperties({
      session,
      object: user,
      props: [
        'realFirstName',
        'realLastName',
        'displayFirstName',
        'displayLastName',
        'phone',
        'timezone',
        'about',
        'status',
        'title',
      ],
      changes: input,
      nodevar: 'user',
    });

    // Update email
    if (input.email) {
      // Remove old emails and relations
      const uniqueProperties: UniqueProperties<User> = {
        email: ['Property', 'EmailAddress'],
      };
      await this.db
        .query()
        .match([node('node', ['User', 'BaseNode'], { id: user.id })])
        .call(setPropLabelsAndValuesDeleted, uniqueProperties)
        .return('*')
        .run();

      try {
        const createdAt = DateTime.local();
        await this.db
          .query()
          .match([node('user', ['User', 'BaseNode'], { id: user.id })])
          .create([
            node('user'),
            relation('out', '', 'email', {
              active: true,
              createdAt,
            }),
            node('email', 'EmailAddress:Property', {
              value: input.email,
              createdAt,
            }),
          ])
          .run();
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
    if (input.roles) {
      await this.authorizationService.checkPower(Powers.GrantRole, session);
      await this.db
        .query()
        .match([
          node('user', ['User', 'BaseNode'], {
            id: input.id,
          }),
          relation('out', 'oldRoleRel', 'roles', { active: true }),
          node('oldRoles', 'Property'),
        ])
        .set({
          values: {
            'oldRoleRel.active': false,
          },
        })
        .run();

      await this.db
        .query()
        .match([
          node('user', ['User', 'BaseNode'], {
            id: input.id,
          }),
        ])
        .create([...this.roleProperties(input.roles)])
        .run();

      await this.authorizationService.roleAddedToUser(input.id, input.roles);
    }

    return await this.readOne(input.id, session);
  }

  @Transactional()
  async delete(id: string, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find User');
    }

    const canDelete = await this.db.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this User'
      );

    const baseNodeLabels = ['BaseNode', 'User'];

    const uniqueProperties: UniqueProperties<User> = {
      email: ['Property', 'EmailAddress'],
    };

    try {
      await this.db.deleteNodeNew<User>({
        object,
        baseNodeLabels,
        uniqueProperties,
      });
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }
  }

  @Transactional()
  async list(input: UserListInput, session: Session): Promise<UserListOutput> {
    const nameSortMap: Partial<Record<typeof input.sort, string>> = {
      displayFirstName: 'toLower(prop.value)',
      displayLastName: 'toLower(prop.value)',
    };

    const sortBy = nameSortMap[input.sort] ?? 'prop.value';

    const query = this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode('User')])
      .call(
        calculateTotalAndPaginateList,
        input,
        this.securedProperties,
        defaultSorter,
        sortBy
      );

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }

  @Transactional()
  async listEducations(
    userId: string,
    input: EducationListInput,
    session: Session
  ): Promise<SecuredEducationList> {
    const query = this.db
      .query()
      .match(matchSession(session)) // Michel Query Refactor Will Fix This
      .match([node('user', 'User', { id: userId })])
      .optionalMatch([
        node('requestingUser'),
        relation('in', 'memberOfReadSecurityGroup', 'member'),
        node('readSecurityGroup', 'SecurityGroup'),
        relation('out', 'sgReadPerms', 'permission'),
        node('canRead', 'Permission', {
          property: 'education',
          read: true,
        }),
        relation('out', 'readPermsOfBaseNode', 'baseNode'),
        node('user'),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', 'memberOfEditSecurityGroup', 'member'),
        node('editSecurityGroup', 'SecurityGroup'),
        relation('out', 'sgEditPerms', 'permission'),
        node('canEdit', 'Permission', {
          property: 'education',
          edit: true,
        }),
        relation('out', 'editPermsOfBaseNode', 'baseNode'),
        node('user'),
      ])
      .return({
        canRead: [{ read: 'canRead' }],
        canEdit: [{ edit: 'canEdit' }],
      });
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

  @Transactional()
  async listOrganizations(
    userId: string,
    input: OrganizationListInput,
    session: Session
  ): Promise<SecuredOrganizationList> {
    const query = this.db
      .query()
      .match(matchSession(session))
      .match([node('user', 'User', { id: userId })])
      .optionalMatch([
        node('requestingUser'),
        relation('in', 'memberOfReadSecurityGroup', 'member'),
        node('readSecurityGroup', 'SecurityGroup'),
        relation('out', 'sgReadPerms', 'permission'),
        node('canRead', 'Permission', {
          property: 'organization',
          read: true,
        }),
        relation('out', 'readPermsOfBaseNode', 'baseNode'),
        node('user'),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', 'memberOfEditSecurityGroup', 'member'),
        node('editSecurityGroup', 'SecurityGroup'),
        relation('out', 'sgEditPerms', 'permission'),
        node('canEdit', 'Permission', {
          property: 'organization',
          edit: true,
        }),
        relation('out', 'editPermsOfBaseNode', 'baseNode'),
        node('user'),
      ])
      .return({
        canRead: [{ read: 'canRead' }],
        canEdit: [{ edit: 'canEdit' }],
      });
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

  @Transactional()
  async listPartners(
    userId: string,
    input: PartnerListInput,
    session: Session
  ): Promise<SecuredPartnerList> {
    const query = this.db
      .query()
      .match(matchSession(session)) // Michel Query Refactor Will Fix This
      .match([node('user', 'User', { id: userId })])
      .optionalMatch([
        node('requestingUser'),
        relation('in', 'memberOfReadSecurityGroup', 'member'),
        node('readSecurityGroup', 'SecurityGroup'),
        relation('out', 'sgReadPerms', 'permission'),
        node('canRead', 'Permission', {
          property: 'partners',
          read: true,
        }),
        relation('out', 'readPermsOfBaseNode', 'baseNode'),
        node('user'),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', 'memberOfEditSecurityGroup', 'member'),
        node('editSecurityGroup', 'SecurityGroup'),
        relation('out', 'sgEditPerms', 'permission'),
        node('canEdit', 'Permission', {
          property: 'partners',
          edit: true,
        }),
        relation('out', 'editPermsOfBaseNode', 'baseNode'),
        node('user'),
      ])
      .return({
        canRead: [{ read: 'canRead' }],
        canEdit: [{ edit: 'canEdit' }],
      });

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

  @Transactional()
  async listUnavailabilities(
    userId: string,
    input: UnavailabilityListInput,
    session: Session
  ): Promise<SecuredUnavailabilityList> {
    const query = this.db
      .query()
      .match(matchSession(session))
      .match([node('user', 'User', { id: userId })])
      .optionalMatch([
        node('requestingUser'),
        relation('in', 'memberOfReadSecurityGroup', 'member'),
        node('readSecurityGroup', 'SecurityGroup'),
        relation('out', 'sgReadPerms', 'permission'),
        node('canRead', 'Permission', {
          property: 'unavailability',
          read: true,
        }),
        relation('out', 'readPermsOfBaseNode', 'baseNode'),
        node('user'),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', 'memberOfEditSecurityGroup', 'member'),
        node('editSecurityGroup', 'SecurityGroup'),
        relation('out', 'sgEditPerms', 'permission'),
        node('canEdit', 'Permission', {
          property: 'unavailability',
          edit: true,
        }),
        relation('out', 'editPermsOfBaseNode', 'baseNode'),
        node('user'),
      ])
      .return({
        canRead: [{ read: 'canRead' }],
        canEdit: [{ edit: 'canEdit' }],
      });
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

  @Transactional()
  async addLocation(
    userId: string,
    locationId: string,
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

  @Transactional()
  async removeLocation(
    userId: string,
    locationId: string,
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

  @Transactional()
  async listLocations(
    userId: string,
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

  @Transactional()
  async createKnownLanguage(
    userId: string,
    languageId: string,
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
      await this.db
        .query()
        .matchNode('user', 'User', { id: userId })
        .matchNode('language', 'Language', { id: languageId })
        .create([
          node('user'),
          relation('out', '', 'knownLanguage', {
            active: true,
            createdAt: DateTime.local(),
            value: languageProficiency,
          }),
          node('language'),
        ])
        .run();
    } catch (e) {
      throw new ServerException('Could not create known language', e);
    }
  }

  @Transactional()
  async deleteKnownLanguage(
    userId: string,
    languageId: string,
    languageProficiency: LanguageProficiency,
    _session: Session
  ): Promise<void> {
    try {
      await this.db
        .query()
        .matchNode('user', 'User', { id: userId })
        .matchNode('language', 'Language', { id: languageId })
        .match([
          [
            node('user'),
            relation('out', 'rel', 'knownLanguage', {
              active: true,
              value: languageProficiency,
            }),
            node('language'),
          ],
        ])
        .setValues({
          'rel.active': false,
        })
        .run();
    } catch (e) {
      throw new ServerException('Could not delete known language', e);
    }
  }

  @Transactional()
  async listKnownLanguages(
    userId: string,
    session: Session
  ): Promise<KnownLanguage[]> {
    const results = await this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode('Language'),
        relation('in', 'knownLanguageRel', 'knownLanguage', { active: true }),
        node('user', 'User', { id: userId }),
      ])
      .with('collect(distinct user) as users, node, knownLanguageRel')
      .raw(`unwind users as user`)
      .return([
        'knownLanguageRel.value as languageProficiency',
        'node.id as languageId',
      ])
      .asResult<{
        languageProficiency: LanguageProficiency;
        languageId: string;
      }>()
      .run();

    const knownLanguages = await Promise.all(
      results.map(async (item) => {
        return {
          language: item.languageId,
          proficiency: item.languageProficiency,
        };
      })
    );

    return knownLanguages as KnownLanguage[];
  }

  @Transactional()
  async checkEmail(email: string): Promise<boolean> {
    const result = await this.db
      .query()
      .raw(
        `
        MATCH
        (email:EmailAddress {
          value: $email
        })
        RETURN
        email.value as email
        `,
        {
          email: email,
        }
      )
      .first();
    if (result) {
      return false;
    }
    return true;
  }

  @Transactional()
  async assignOrganizationToUser(
    request: AssignOrganizationToUser,
    session: Session
  ): Promise<void> {
    //TO DO: Refactor session in the future
    const querySession = this.db.query();
    if (session.userId) {
      querySession.match([
        matchSession(session, { withAclEdit: 'canCreateOrg' }),
      ]);
    }

    const primary =
      request.primary !== null && request.primary !== undefined
        ? request.primary
        : false;

    await this.db
      .query()
      .match([
        node('user', 'User', {
          id: request.userId,
        }),
        relation('out', 'oldRel', 'organization', {
          active: true,
        }),
        node('primaryOrg', 'Organization', {
          id: request.orgId,
        }),
      ])
      .setValues({ 'oldRel.active': false })
      .return('oldRel')
      .first();

    if (primary) {
      await this.db
        .query()
        .match([
          node('user', 'User', {
            id: request.userId,
          }),
          relation('out', 'oldRel', 'primaryOrganization', {
            active: true,
          }),
          node('primaryOrg', 'Organization', {
            id: request.orgId,
          }),
        ])
        .setValues({ 'oldRel.active': false })
        .return('oldRel')
        .first();
    }

    let queryCreate;
    if (primary) {
      queryCreate = this.db.query().raw(
        `
        MATCH (primaryOrg:Organization {id: $orgId}),
        (user:User {id: $userId})
        CREATE (primaryOrg)<-[:primaryOrganization {active: true, createdAt: datetime()}]-(user),
        (primaryOrg)<-[:organization {active: true, createdAt: datetime()}]-(user)
        RETURN  user.id as id
      `,
        {
          userId: request.userId,
          orgId: request.orgId,
        }
      );
    } else {
      queryCreate = this.db.query().raw(
        `
        MATCH (org:Organization {id: $orgId}),
        (user:User {id: $userId})
        CREATE (org)<-[:organization {active: true, createdAt: datetime()}]-(user)
        RETURN  user.id as id
      `,
        {
          userId: request.userId,
          orgId: request.orgId,
        }
      );
    }

    const result = await queryCreate.first();

    if (!result) {
      throw new ServerException('Failed to assign organzation to user');
    }
  }

  @Transactional()
  async removeOrganizationFromUser(
    request: RemoveOrganizationFromUser,
    _session: Session
  ): Promise<void> {
    const removeOrg = this.db
      .query()
      .match([
        node('user', 'User', {
          id: request.userId,
        }),
        relation('out', 'oldRel', 'organization', {
          active: true,
        }),
        node('org', 'Organization', {
          id: request.orgId,
        }),
      ])
      .optionalMatch([
        node('user'),
        relation('out', 'primary', 'primaryOrganization', { active: true }),
        node('org'),
      ])
      .setValues({ 'oldRel.active': false })
      .return({ oldRel: [{ id: 'oldId' }], primary: [{ id: 'primaryId' }] });
    let resultOrg;
    try {
      resultOrg = await removeOrg.first();
    } catch (e) {
      throw new NotFoundException('user and org are not connected');
    }

    if (resultOrg?.primaryId) {
      const removePrimary = this.db
        .query()
        .match([
          node('user', 'User', {
            id: request.userId,
          }),
          relation('out', 'oldRel', 'primaryOrganization', {
            active: true,
          }),
          node('primaryOrg', 'Organization', {
            id: request.orgId,
          }),
        ])
        .setValues({ 'oldRel.active': false })
        .return('oldRel');
      try {
        await removePrimary.first();
      } catch {
        this.logger.debug('not primary');
      }
    }

    if (!resultOrg) {
      throw new ServerException('Failed to assign organzation to user');
    }
  }

  async checkUserConsistency(session: Session): Promise<boolean> {
    const users = await this.db
      .query()
      .match([matchSession(session), [node('user', 'User')]])
      .return('user.id as id')
      .run();

    return (
      (
        await Promise.all(
          users.map(async (user) => {
            return await this.db.hasProperties({
              session,
              id: user.id,
              props: [
                'email',
                'realFirstName',
                'realLastName',
                'displayFirstName',
                'displayLastName',
                'phone',
                'timezone',
                'about',
              ],
              nodevar: 'user',
            });
          })
        )
      ).every((n) => n) &&
      (
        await Promise.all(
          users.map(async (user) => {
            return await this.db.isUniqueProperties({
              session,
              id: user.id,
              props: [
                'email',
                'realFirstName',
                'realLastName',
                'displayFirstName',
                'displayLastName',
                'phone',
                'timezone',
                'about',
              ],
              nodevar: 'user',
            });
          })
        )
      ).every((n) => n)
    );
  }
}
