import {
  Injectable,
  NotFoundException,
  UnauthorizedException as UnauthenticatedException,
} from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { difference } from 'lodash';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { DuplicateException, ISession, ServerException } from '../../common';
import {
  addAllSecureProperties,
  addBaseNodeMetaPropsWithClause,
  addPropertyCoalesceWithClause,
  ConfigService,
  DatabaseService,
  filterByString,
  ILogger,
  listWithSecureObject,
  Logger,
  matchRequestingUser,
  matchSession,
  matchUserPermissions,
  OnIndex,
  runListQuery,
  UniquenessError,
} from '../../core';
import {
  OrganizationListInput,
  OrganizationService,
  SecuredOrganizationList,
} from '../organization';
import { Role } from '../project/project-member/dto/role.dto';
import {
  AssignOrganizationToUser,
  CreatePerson,
  RemoveOrganizationFromUser,
  UpdateUser,
  User,
  UserListInput,
  UserListOutput,
} from './dto';
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

@Injectable()
export class UserService {
  constructor(
    private readonly educations: EducationService,
    private readonly organizations: OrganizationService,
    private readonly unavailabilities: UnavailabilityService,
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Logger('user:service') private readonly logger: ILogger
  ) {}

  @OnIndex()
  async createIndexes() {
    // language=Cypher (for webstorm)
    const constraints = [
      // USER NODE
      'CREATE CONSTRAINT ON (n:User) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:User) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:User) ASSERT EXISTS(n.active)',
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

      // PROPERTY NODE
      // 'CREATE CONSTRAINT ON (n:Property) ASSERT EXISTS(n.value)',
      // 'CREATE CONSTRAINT ON (n:Property) ASSERT EXISTS(n.active)',
    ];
    for (const query of constraints) {
      await this.db.query().raw(query).run();
    }
  }

  // helper method for defining properties
  property = (prop: string, value: any | null) => {
    const propName = prop === 'roles' ? `role${value}` : prop;
    const createdAt = DateTime.local();
    return [
      [
        node('user'),
        relation('out', '', prop, {
          active: true,
          createdAt,
        }),
        node(propName, 'Property', {
          active: true,
          value,
        }),
      ],
    ];
  };

  // helper method for defining properties
  permission = (property: string) => {
    const createdAt = DateTime.local();
    return [
      [
        node('adminSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: true,
          admin: true,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node('user'),
      ],
      [
        node('readerSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: false,
          admin: false,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node('user'),
      ],
    ];
  };

  rootUserAccess = (session?: ISession) => {
    const createdAt = DateTime.local();

    if (!session) {
      return [];
    }
    return [
      [
        node('adminSG'),
        relation('out', '', 'member', { active: true, createdAt }),
        node('rootuser'),
      ],
      [
        node('readerSG'),
        relation('out', '', 'member', { active: true, createdAt }),
        node('rootuser'),
      ],
    ];
  };

  roleProperties = (roles?: Role[]) => {
    let roleProperties: any[] = [];
    roles?.forEach(
      (role) =>
        (roleProperties = roleProperties.concat(this.property('roles', role)))
    );

    return roleProperties;
  };

  async create(input: CreatePerson, session?: ISession): Promise<string> {
    const id = generate();
    const createdAt = DateTime.local();

    const query = this.db.query();
    if (session) {
      query.match([
        node('rootuser', 'User', {
          active: true,
          id: this.config.rootAdmin.id,
        }),
      ]);
    }
    query.create([
      [
        node('user', ['User', 'BaseNode'], {
          id,
          active: true,
          createdAt,
          createdByUserId: 'system',
          canCreateBudget: true,
          canReadBudgets: true,
          canCreateFile: true,
          canReadFiles: true,
          canCreateFileVersion: true,
          canReadFileVersions: true,
          canCreateDirectory: true,
          canReadDirectorys: true,
          canCreateOrg: true,
          canReadOrgs: true,
          canCreateFilm: true,
          canReadFilms: true,
          canCreateLiteracyMaterial: true,
          canReadLiteracyMaterials: true,
          canCreateStory: true,
          canReadStorys: true,
          canReadUsers: true,
          canCreateLanguage: true,
          canReadLanguages: true,
          canCreateEducation: true,
          canReadEducationList: true,
          canCreateUnavailability: true,
          canReadUnavailabilityList: true,
          canCreatePartnership: true,
          canReadPartnerships: true,
          canCreateProduct: true,
          canReadProducts: true,
          canCreateProject: true,
          canReadProjects: true,
          canCreateZone: true,
          canReadZone: true,
          canCreateRegion: true,
          canReadRegion: true,
          canCreateCountry: true,
          canReadCountry: true,
          canCreateCeremony: true,
          canReadCeremonies: true,
          canCreateProjectMember: true,
          canReadProjectMembers: true,
          canCreateEngagement: true,
          canReadEngagements: true,
          canDeleteOwnUser: true,
          canDeleteLocation: true,
          canCreateLocation: true,
          canCreateEthnologueLanguage: true,
          canReadEthnologueLanguages: true,
          owningOrgId: 'Seed Company',
          isAdmin: true,
        }),
        relation('out', '', 'email', {
          active: true,
          createdAt,
        }),
        node('email', 'EmailAddress:Property', {
          active: true,
          value: input.email,
          createdAt,
        }),
      ],
      ...this.property('realFirstName', input.realFirstName),
      ...this.property('realLastName', input.realLastName),
      ...this.property('displayFirstName', input.displayFirstName),
      ...this.property('displayLastName', input.displayLastName),
      ...this.property('phone', input.phone),
      ...this.property('timezone', input.timezone),
      ...this.property('bio', input.bio),
      ...this.property('status', input.status),
      ...this.roleProperties(input.roles),
      [
        node('user'),
        relation('in', '', 'member', { active: true, createdAt }),
        node('adminSG', 'SecurityGroup', {
          id: generate(),
          createdAt,
          active: true,
          name: `${input.realFirstName} ${input.realLastName} admin`,
        }),
      ],
      [
        node('user'),
        relation('in', '', 'member', { active: true, createdAt }),
        node('readerSG', 'SecurityGroup', {
          id: generate(),
          createdAt,
          active: true,
          name: `${input.realFirstName} ${input.realLastName} users`,
        }),
      ],
      ...this.rootUserAccess(session),
      ...this.permission('realFirstName'),
      ...this.permission('realLastName'),
      ...this.permission('displayFirstName'),
      ...this.permission('displayLastName'),
      ...this.permission('email'),
      ...this.permission('education'),
      ...this.permission('organization'),
      ...this.permission('unavailablity'),
      ...this.permission('phone'),
      ...this.permission('timezone'),
      ...this.permission('bio'),
      ...this.permission('status'),
      ...this.permission('roles'),
    ]);

    query.return({
      user: [{ id: 'id' }],
      readerSG: [{ id: 'readerSGid' }],
      adminSG: [{ id: 'adminSGid' }],
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
      .match(node('publicSg', 'PublicSecurityGroup', { active: true }))

      .create([
        node('publicSg'),
        relation('out', '', 'member', { active: true }),
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
            active: true,
            id: this.config.defaultOrg.id,
          }),
        ])
        .create([
          node('user'),
          relation('in', '', 'member', { active: true }),
          node('orgPublicSg'),
        ])
        .run();

      if (attachToOrgPublicSg) {
        //
      }
    }

    if (session?.userId) {
      const assignSG = this.db
        .query()
        .match([node('requestingUser', 'User', { id: session.userId })])
        .match([
          node('rootuser', 'User', {
            active: true,
            id: this.config.rootAdmin.id,
          }),
        ]);
      assignSG
        .create([
          [
            node('adminSG'),
            relation('out', '', 'member', {
              active: true,
              admin: true,
              createdAt,
            }),
            node('requestingUser'),
          ],
          [
            node('readerSG'),
            relation('out', '', 'member', {
              active: true,
              admin: true,
              createdAt,
            }),
            node('requestingUser'),
          ],
          [
            node('adminSG'),
            relation('out', '', 'member', { active: true, createdAt }),
            node('rootuser'),
          ],
          [
            node('readerSG'),
            relation('out', '', 'member', { active: true, createdAt }),
            node('rootuser'),
          ],
        ])
        .return({
          requestingUser: [{ id: 'id' }],
          readerSG: [{ id: 'readerSGid' }],
          adminSG: [{ id: 'adminSGid' }],
        });
      await assignSG.first();
    }

    return result.id;
  }

  async readOne(id: string, session: ISession): Promise<User> {
    if (!session.userId) {
      session.userId = this.config.anonUser.id;
    }

    const props = [
      'email',
      'realFirstName',
      'realLastName',
      'displayFirstName',
      'displayLastName',
      'phone',
      'timezone',
      'bio',
      'status',
    ];
    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, 'User', id)
      .call(addAllSecureProperties, ...[...props, 'roles'])
      .with([
        ...props.map(addPropertyCoalesceWithClause),
        `
        {
          value: collect(distinct roles.value),
          canRead: coalesce(rolesReadPerm.read, false),
          canEdit: coalesce(rolesEditPerm.edit, false)
        } as roles
        `,
        'coalesce(node.id) as id',
        'coalesce(node.createdAt) as createdAt',
      ])
      .returnDistinct([...props, 'roles', 'id', 'createdAt']);

    const result = (await query.first()) as User | undefined;
    if (!result) {
      throw new NotFoundException('Could not find user');
    }

    const response: any = {
      ...result,
      roles: {
        value: result.roles.value || [],
        canRead: result.roles.canRead,
        canEdit: result.roles.canEdit,
      },
    };
    return response;
  }

  async update(input: UpdateUser, session: ISession): Promise<User> {
    this.logger.info('mutation update User', { input, session });
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
        'bio',
        'status',
      ],
      changes: input,
      nodevar: 'user',
    });

    // Update roles
    if (input.roles) {
      const newRoles = difference(input.roles, user.roles.value) as Role[];
      await this.db
        .query()
        .match([
          node('user', ['User', 'BaseNode'], {
            active: true,
            id: input.id,
          }),
        ])
        .create([...this.roleProperties(newRoles)])
        .run();
    }

    return this.readOne(input.id, session);
  }

  async delete(id: string, session: ISession): Promise<void> {
    const user = await this.readOne(id, session);
    try {
      await this.db.deleteNode({
        session,
        object: user,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      this.logger.error('Could not delete user', { exception: e });
      throw new ServerException('Could not delete user');
    }
  }

  async list(
    { filter, ...input }: UserListInput,
    session: ISession
  ): Promise<UserListOutput> {
    const label = 'User';
    const baseNodeMetaProps = ['id', 'createdAt'];
    const secureProps = [
      'email',
      'realFirstName',
      'realLastName',
      'displayFirstName',
      'displayLastName',
      'phone',
      'timezone',
      'bio',
      'status',
    ];

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, 'User');

    if (filter.displayFirstName) {
      query.call(
        filterByString,
        label,
        'displayFirstName',
        filter.displayFirstName
      );
    } else if (filter.displayLastName) {
      query.call(
        filterByString,
        label,
        'displayLastName',
        filter.displayLastName
      );
    }

    // match on the rest of the properties of the object requested
    query
      .call(
        addAllSecureProperties,
        ...secureProps
        //...unsecureProps
      )

      // form return object
      // ${listWithUnsecureObject(unsecureProps)}, // removed from a few lines down
      .with(
        `
          {
            ${addBaseNodeMetaPropsWithClause(baseNodeMetaProps)},
            ${listWithSecureObject(secureProps)}
          } as node
        `
      );

    return runListQuery(query, input, secureProps.includes(input.sort));
  }

  async listEducations(
    userId: string,
    input: EducationListInput,
    session: ISession
  ): Promise<SecuredEducationList> {
    const query = this.db
      .query()
      .match(matchSession(session, { withAclEdit: 'canReadEducationList' })) // Michel Query Refactor Will Fix This
      .match([node('user', 'User', { active: true, id: userId })])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canRead', 'Permission', {
          property: 'education',
          active: true,
          read: true,
        }),
        // relation('out', '', 'baseNode', { active: true }),
        // node('user'),
      ])
      .return({
        canRead: [{ read: 'canRead', edit: 'canEdit' }],
      });
    let user;
    try {
      user = await query.first();
    } catch (e) {
      this.logger.error(`Could not find education for user ${session.userId}`);
      throw new ServerException('Could not find education');
    }
    if (!user) {
      throw new NotFoundException('Could not find user');
    }
    if (!user.canRead) {
      throw new UnauthenticatedException('cannot read education list');
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
      canCreate: user.canEdit,
    };
  }

  async listOrganizations(
    userId: string,
    input: OrganizationListInput,
    session: ISession
  ): Promise<SecuredOrganizationList> {
    // Just a thought, seemed like a good idea to try to reuse the logic/query there.
    const query = this.db
      .query()
      .match(matchSession(session, { withAclEdit: 'canReadOrgs' }))
      .match([node('user', 'User', { active: true, id: userId })])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canRead', 'Permission', {
          property: 'organization',
          active: true,
          read: true,
        }),
        // relation('out', '', 'baseNode', { active: true }),
        // node('user'),
      ])
      .return({
        canRead: [{ read: 'canRead', edit: 'canEdit' }],
      });
    let user;
    try {
      user = await query.first();
    } catch (e) {
      this.logger.error(
        `Could not find organizations for user ${session.userId}`
      );
      throw new ServerException('Could not find organization');
    }
    if (!user) {
      throw new NotFoundException('Could not find user');
    }
    if (!user.canRead) {
      throw new UnauthenticatedException(
        'cannot read organization list' +
          `DEBUG: {requestingUser, ${session} target UserId ${userId}}`
      );
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
      canCreate: user.canEdit,
    };
  }

  async listUnavailabilities(
    userId: string,
    input: UnavailabilityListInput,
    session: ISession
  ): Promise<SecuredUnavailabilityList> {
    const query = this.db
      .query()
      .match(
        matchSession(session, { withAclEdit: 'canReadUnavailabilityList' })
      )
      .match([node('user', 'User', { active: true, id: userId })])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canRead', 'Permission', {
          property: 'unavailablity',
          active: true,
          read: true,
        }),
        // relation('out', '', 'baseNode', { active: true }),
        // node('user'),
      ])
      .return({
        canRead: [{ read: 'canRead', edit: 'canEdit' }],
      });
    let user;
    try {
      user = await query.first();
    } catch (e) {
      this.logger.error(
        `Could not find unavailablity for user ${session.userId}`
      );
      throw new ServerException('Could not find unavailablity');
    }
    if (!user) {
      throw new NotFoundException('Could not find user');
    }
    if (!user.canRead) {
      throw new UnauthenticatedException('cannot read unavailablity list');
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
      canCreate: user.canEdit,
    };
  }

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

  async assignOrganizationToUser(
    request: AssignOrganizationToUser,
    session: ISession
  ): Promise<boolean> {
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
          active: true,
          id: request.userId,
        }),
        relation('out', 'oldRel', 'organization', {
          active: true,
        }),
        node('primaryOrg', 'Organization', {
          active: true,
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
            active: true,
            id: request.userId,
          }),
          relation('out', 'oldRel', 'primaryOrganization', {
            active: true,
          }),
          node('primaryOrg', 'Organization', {
            active: true,
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
        MATCH (primaryOrg:Organization {id: $orgId, active: true}),
        (user:User {id: $userId, active: true})
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
        MATCH (org:Organization {id: $orgId, active: true}),
        (user:User {id: $userId, active: true})
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
      return false;
    }
    return true;
  }

  async removeOrganizationFromUser(
    request: RemoveOrganizationFromUser,
    _session: ISession
  ): Promise<boolean> {
    const removeOrg = this.db
      .query()
      .match([
        node('user', 'User', {
          active: true,
          id: request.userId,
        }),
        relation('out', 'oldRel', 'organization', {
          active: true,
        }),
        node('org', 'Organization', {
          active: true,
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
            active: true,
            id: request.userId,
          }),
          relation('out', 'oldRel', 'primaryOrganization', {
            active: true,
          }),
          node('primaryOrg', 'Organization', {
            active: true,
            id: request.orgId,
          }),
        ])
        .setValues({ 'oldRel.active': false })
        .return('oldRel');
      try {
        await removePrimary.first();
      } catch {
        this.logger.info('not primary');
      }
    }

    if (!resultOrg) {
      return false;
    }
    return true;
  }

  async checkUserConsistency(session: ISession): Promise<boolean> {
    const users = await this.db
      .query()
      .match([
        matchSession(session),
        [
          node('user', 'User', {
            active: true,
          }),
        ],
      ])
      .return('user.id as id')
      .run();

    return (
      (
        await Promise.all(
          users.map(async (user) => {
            return this.db.hasProperties({
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
                'bio',
              ],
              nodevar: 'user',
            });
          })
        )
      ).every((n) => n) &&
      (
        await Promise.all(
          users.map(async (user) => {
            return this.db.isUniqueProperties({
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
                'bio',
              ],
              nodevar: 'user',
            });
          })
        )
      ).every((n) => n)
    );
  }
}
