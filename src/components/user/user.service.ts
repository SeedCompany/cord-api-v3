import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { difference } from 'lodash';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import {
  DuplicateException,
  ISession,
  NotFoundException,
  ServerException,
  UnauthenticatedException,
} from '../../common';
import {
  ConfigService,
  DatabaseService,
  getPermList,
  getPropList,
  ILogger,
  Logger,
  matchRequestingUser,
  matchSession,
  OnIndex,
  UniquenessError,
} from '../../core';
import {
  calculateTotalAndPaginateList,
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
  private readonly securedProperties = {
    email: true,
    realFirstName: true,
    realLastName: true,
    displayFirstName: true,
    displayLastName: true,
    phone: true,
    timezone: true,
    bio: true,
    status: true,
    title: true,
    roles: true,
  };

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
    return [
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
  }

  // helper method for defining properties
  property = (prop: string, value: any | null, propVar = prop) => {
    const createdAt = DateTime.local();
    return [
      [
        node('user'),
        relation('out', '', prop, {
          active: true,
          createdAt,
        }),
        node(propVar, 'Property', {
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
    return (roles || []).flatMap((role) =>
      this.property('roles', role, `role${role}`)
    );
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
      ...this.property('title', input.title),
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
      ...this.permission('title'),
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
    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'User', { active: true, id })])
      .call(getPermList, 'node')
      .call(getPropList, 'permList')
      .return('propList, permList, node')
      .asResult<StandardReadResult<DbPropsOfDto<User>>>();

    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find user', 'user.id');
    }

    const rolesValue = result.propList
      .filter((prop) => prop.property === 'roles')
      .map((prop) => prop.value as Role);

    const securedProps = parseSecuredProperties(
      result.propList,
      result.permList,
      this.securedProperties
    );
    return {
      ...parseBaseNodeProperties(result.node),
      ...securedProps,
      roles: {
        ...securedProps.roles,
        value: rolesValue,
      },
    };
  }

  async update(input: UpdateUser, session: ISession): Promise<User> {
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
        'bio',
        'status',
        'title',
      ],
      changes: input,
      nodevar: 'user',
    });

    // Update roles
    if (input.roles) {
      const newRoles = difference(input.roles, user.roles.value);
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

    return await this.readOne(input.id, session);
  }

  async delete(id: string, session: ISession): Promise<void> {
    const user = await this.readOne(id, session);
    // remove EmailAddress label so uniqueness constraint works only for exisiting users
    await this.db
      .query()
      .match([
        node('user', 'User', { id, active: true }),
        relation('out', '', 'email', { active: true }),
        node('email', 'EmailAddress', { active: true }),
      ])
      .removeLabels({
        email: 'EmailAddress',
      })
      .first();
    try {
      await this.db.deleteNode({
        session,
        object: user,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (exception) {
      this.logger.error('Could not delete user', { exception });
      throw new ServerException('Could not delete user', exception);
    }
  }

  async list(input: UserListInput, session: ISession): Promise<UserListOutput> {
    const query = this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode('User')])
      .call(calculateTotalAndPaginateList, input, (q, sort, order) =>
        sort in this.securedProperties
          ? q
              .match([
                node('node'),
                relation('out', '', sort),
                node('prop', 'Property', { active: true }),
              ])
              .with('*')
              .orderBy('prop.value', order)
          : q.with('*').orderBy(`node.${sort}`, order)
      );

    return await runListQuery(query, input, (id) => this.readOne(id, session));
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
      this.logger.warning('Cannot read organization list', {
        userId,
      });
      throw new UnauthenticatedException('cannot read organization list');
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
      throw new UnauthenticatedException('cannot read unavailability list');
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
        this.logger.debug('not primary');
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
