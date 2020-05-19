import {
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
  UnauthorizedException as UnauthenticatedException,
} from '@nestjs/common';
import { ForbiddenError } from 'apollo-server-core';
import * as argon2 from 'argon2';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { CalendarDate, ISession } from '../../common';
import {
  DatabaseService,
  ILogger,
  Logger,
  matchSession,
  OnIndex,
} from '../../core';
import { LoginInput } from '../authentication/authentication.dto';
import { AuthorizationService } from '../authorization';
import {
  OrganizationListInput,
  OrganizationService,
  SecuredOrganizationList,
} from '../organization';
import {
  CreateUser,
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

import _ = require('lodash');

@Injectable()
export class UserService {
  constructor(
    private readonly auth: AuthorizationService,
    private readonly educations: EducationService,
    private readonly organizations: OrganizationService,
    private readonly unavailabilities: UnavailabilityService,
    private readonly db: DatabaseService,
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
      'CREATE CONSTRAINT ON (n:User) ASSERT EXISTS(n.owningOrgId)',
      'CREATE CONSTRAINT ON (n:User) ASSERT EXISTS(n.owningOrgId)',

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
      'CREATE CONSTRAINT ON (n:Property) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:Property) ASSERT EXISTS(n.active)',
    ];
    for (const query of constraints) {
      await this.db.query().raw(query).run();
    }
  }

  async list(
    { page, count, sort, order, filter }: UserListInput,
    session: ISession
  ): Promise<UserListOutput> {
    const result = await this.db.list<User>({
      session,
      nodevar: 'user',
      aclReadProp: 'canReadUsers',
      aclEditProp: 'canCreateUser',
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
      input: {
        page,
        count,
        sort,
        order,
        filter,
      },
    });

    return {
      items: result.items,
      hasMore: result.hasMore,
      total: result.total,
    };
  }

  async listEducations(
    userId: string,
    input: EducationListInput,
    session: ISession
  ): Promise<SecuredEducationList> {
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
      canRead: true,
      canCreate: true,
    };
  }

  async listOrganizations(
    userId: string,
    input: OrganizationListInput,
    session: ISession
  ): Promise<SecuredOrganizationList> {
    // Just a thought, seemed like a good idea to try to reuse the logic/query there.
    const result = await this.organizations.list(
      {
        ...input,
        filter: {
          ...input.filter,
          userIds: [userId],
        },
      },
      session
    );

    return {
      ...result,
      canRead: true, // TODO
      canCreate: true, // TODO
    };
  }

  async listUnavailabilities(
    userId: string,
    input: UnavailabilityListInput,
    session: ISession
  ): Promise<SecuredUnavailabilityList> {
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
      canRead: true,
      canCreate: true,
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

  async createAndLogin(input: CreateUser, session: ISession): Promise<User> {
    const userId = await this.create(input, session);
    await this.login(
      {
        email: input.email,
        password: input.password,
      },
      session
    );

    return this.readOne(userId, session);
  }

  async create(
    input: CreateUser,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    session: ISession = {} as ISession
  ): Promise<string> {
    // ensure token doesn't have any users attached to it
    if (!_.isEmpty(session)) {
      await this.logout(session.token);
    }

    const id = generate();
    const pash = await argon2.hash(input.password);
    const createdAt = DateTime.local();

    // helper method for defining properties
    const property = (prop: string, value: any) => {
      if (!value) {
        return [];
      }

      return [
        [
          node('user'),
          relation('out', '', prop, {
            active: true,
            createdAt,
          }),
          node(prop, 'Property', {
            active: true,
            value,
          }),
        ],
      ];
    };
    // helper method for defining properties
    const permission = (
      property: string,
      sg: string,
      read: boolean,
      edit: boolean,
      admin: boolean
    ) => {
      return [
        [
          node(sg),
          relation('out', '', 'permission', {
            active: true,
            createdAt,
          }),
          node('', 'Permission', {
            property,
            active: true,
            read,
            edit,
            admin,
          }),
          relation('out', '', 'baseNode', {
            active: true,
            createdAt,
          }),
          node('user'),
        ],
      ];
    };

    const query = this.db.query().create([
      [
        node('user', 'User', {
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
      ...property('password', pash),
      ...property('realFirstName', input.realFirstName),
      ...property('realLastName', input.realLastName),
      ...property('displayFirstName', input.displayFirstName),
      ...property('displayLastName', input.displayLastName),
      ...property('phone', input.phone),
      ...property('timezone', input.timezone),
      ...property('bio', input.bio),
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
      ...permission('password', 'adminSG', true, true, true),
      ...permission('realFirstName', 'adminSG', true, true, true),
      ...permission('realLastName', 'adminSG', true, true, true),
      ...permission('displayFirstName', 'adminSG', true, true, true),
      ...permission('displayLastName', 'adminSG', true, true, true),
      ...permission('email', 'adminSG', true, true, true),
      ...permission('education', 'adminSG', true, true, true),
      ...permission('phone', 'adminSG', true, true, true),
      ...permission('timezone', 'adminSG', true, true, true),
      ...permission('bio', 'adminSG', true, true, true),
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
      ...permission('password', 'readerSG', true, false, false),
      ...permission('realFirstName', 'readerSG', true, false, false),
      ...permission('realLastName', 'readerSG', true, false, false),
      ...permission('displayFirstName', 'readerSG', true, false, false),
      ...permission('displayLastName', 'readerSG', true, false, false),
      ...permission('email', 'readerSG', true, false, false),
      ...permission('education', 'readerSG', true, false, false),
      ...permission('phone', 'readerSG', true, false, false),
      ...permission('timezone', 'readerSG', true, false, false),
      ...permission('bio', 'readerSG', true, false, false),
    ]);

    query.return({
      user: [{ id: 'id' }],
      readerSG: [{ id: 'readerSGid' }],
      adminSG: [{ id: 'adminSGid' }],
    });
    const result = await query.first();

    if (!result) {
      throw new ServerException('failed to create user');
    } else {
      if (session.userId) {
        const assignSG = this.db
          .query()
          .match([node('requestingUser', 'User', { id: session.userId })]);
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
  }

  async readOne(id: string, session: ISession): Promise<User> {
    this.logger.info('query read User ', { id, session });
    const property = (property: string, sg: any) => {
      const perm = property + 'Perm';
      return [
        [
          node(sg),
          relation('out', '', 'permission', { active: true }),
          node(perm, 'Permission', {
            property,
            read: true,
            active: true,
          }),
          relation('out', '', 'baseNode'),
          node('user'),
          relation('out', '', property, { active: true }),
          node(property, 'Property', { active: true }),
        ],
      ];
    };

    const query = this.db
      .query()
      .match([node('user', 'User', { active: true, id })])
      .optionalMatch([
        [
          node('sg', 'SecurityGroup', { active: true }),
          relation('out', '', 'member', {
            active: true,
          }),
          node('user'),
        ],
      ])
      .optionalMatch([
        ...property('email', 'sg'),
        ...property('realFirstName', 'sg'),
        ...property('realLastName', 'sg'),
        ...property('displayFirstName', 'sg'),
        ...property('displayLastName', 'sg'),
        ...property('phone', 'sg'),
        ...property('bio', 'sg'),
        ...property('timezone', 'sg'),
      ])
      .return({
        email: [{ value: 'email' }],
        realFirstName: [{ value: 'realFirstName' }],
        realLastName: [{ value: 'realLastName' }],
        displayFirstName: [{ value: 'displayFirstName' }],
        displayLastName: [{ value: 'displayLastName' }],
        phone: [{ value: 'phone' }],
        timezone: [{ value: 'timezone' }],
        bio: [{ value: 'bio' }],
        user: [{ createdAt: 'createdAt', id: 'id' }],
        emailPerm: [{ read: 'emailRead', edit: 'emailEdit' }],
        realFirstNamePerm: [
          { read: 'realFirstNameRead', edit: 'realFirstNameEdit' },
        ],
        realLastNamePerm: [
          { read: 'realLastNameRead', edit: 'realLastNameEdit' },
        ],
        displayFirstNamePerm: [
          { read: 'displayFirstNameRead', edit: 'displayFirstNameEdit' },
        ],
        displayLastNamePerm: [
          { read: 'displayLastNameRead', edit: 'displayLastNameEdit' },
        ],
        phonePerm: [{ read: 'phoneRead', edit: 'phoneEdit' }],
        timezonePerm: [{ read: 'timezoneRead', edit: 'timezoneEdit' }],
        bioPerm: [{ read: 'bioRead', edit: 'bioEdit' }],
        sg: [{ id: 'sgId' }],
      });

    const result = await query.first();

    if (result) {
      const user: User = {
        id: result.id,
        createdAt: result.createdAt,
        email: {
          value: result.email,
          canRead: !!result.emailRead,
          canEdit: !!result.emailEdit,
        },
        realFirstName: {
          value: result.realFirstName,
          canRead: !!result.realFirstNameRead,
          canEdit: !!result.realFirstNameEdit,
        },
        realLastName: {
          value: result.realLastName,
          canRead: !!result.realLastNameRead,
          canEdit: !!result.realLastNameEdit,
        },
        displayFirstName: {
          value: result.displayFirstName,
          canRead: !!result.displayFirstNameRead,
          canEdit: !!result.displayFirstNameEdit,
        },
        displayLastName: {
          value: result.displayLastName,
          canRead: !!result.displayLastNameRead,
          canEdit: !!result.displayLastNameEdit,
        },
        phone: {
          value: result.phone,
          canRead: !!result.phoneRead,
          canEdit: !!result.phoneEdit,
        },
        timezone: {
          value: result.timezone,
          canRead: !!result.timezoneRead,
          canEdit: !!result.timezoneEdit,
        },
        bio: {
          value: result.bio,
          canRead: !!result.bioRead,
          canEdit: !!result.bioEdit,
        },
      };
      return user;
    } else {
      // maybe we don't have permission, let's just get the pubic info
      const query = this.db
        .query()
        .match([node('user', 'User', { active: true, id })]);
      query.return(['user']);

      const noPerm = await query.first();
      if (noPerm) {
        throw new ForbiddenError('Not allowed');
      }

      throw new NotFoundException(`Could not find user`);
    }

    return {
      id,
      createdAt: CalendarDate.fromISO('1000-10-10'),
      email: { value: '', canEdit: false, canRead: false },
      realFirstName: { value: '', canEdit: false, canRead: false },
      realLastName: { value: '', canEdit: false, canRead: false },
      displayFirstName: { value: '', canEdit: false, canRead: false },
      displayLastName: { value: '', canEdit: false, canRead: false },
      phone: { value: '', canEdit: false, canRead: false },
      timezone: { value: '', canEdit: false, canRead: false },
      bio: { value: '', canEdit: false, canRead: false },
    };
  }

  async update(input: UpdateUser, session: ISession): Promise<User> {
    this.logger.info('mutation update User', { input, session });
    const user = await this.readOne(input.id, session);

    return this.db.sgUpdateProperties({
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
      ],
      changes: input,
      nodevar: 'user',
    });
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

  // copied from Authentication service.  Not DRY but circular dependency resolved
  async login(input: LoginInput, session: ISession): Promise<string> {
    const result1 = await this.db
      .query()
      .raw(
        `
      MATCH
        (token:Token {
          active: true,
          value: $token
        })
      MATCH
        (:EmailAddress {active: true, value: $email})
        <-[:email {active: true}]-
        (user:User {
          active: true
        })
        -[:password {active: true}]->
        (password:Property {active: true})
      RETURN
        password.value as pash
      `,
        {
          token: session.token,
          email: input.email,
        }
      )
      .first();

    if (!result1 || !(await argon2.verify(result1.pash, input.password))) {
      throw new UnauthenticatedException('Invalid credentials');
    }

    const result2 = await this.db
      .query()
      .raw(
        `
          MATCH
            (token:Token {
              active: true,
              value: $token
            }),
            (:EmailAddress {active: true, value: $email})
            <-[:email {active: true}]-
            (user:User {
              active: true
            })
          OPTIONAL MATCH
            (token)-[r]-()
          DELETE r
          CREATE
            (user)-[:token {active: true, createdAt: datetime()}]->(token)
          RETURN
            user.id as id
        `,
        {
          token: session.token,
          email: input.email,
        }
      )
      .first();

    if (!result2 || !result2.id) {
      throw new ServerException('Login failed');
    }

    return result2.id;
  }

  async logout(token: string): Promise<void> {
    await this.db
      .query()
      .raw(
        `
      MATCH
        (token:Token)-[r]-()
      DELETE
        r
      RETURN
        token.value as token
      `,
        {
          token,
        }
      )
      .run();
  }
}
