import { Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { node, relation } from 'cypher-query-builder';
import { generate } from 'shortid';
import { DatabaseService, ILogger, Logger, OnIndex } from '../../core';
import { ISession } from '../auth';
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

@Injectable()
export class UserService {
  constructor(
    private readonly organizations: OrganizationService,
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
      await this.db
        .query()
        .raw(query)
        .run();
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

  async create(input: CreateUser, session: ISession): Promise<User> {
    if (!input.password) {
      throw new Error('Password is required when creating a new user');
    }

    // ensure token doesn't have any users attached to it
    // await this.logout(session.token);

    const id = generate();
    const pash = await argon2.hash(input.password);

    await this.db
      .query()
      .matchNode('token', 'Token', { active: true, value: session.token })
      .create([
        [
          node('user', 'User', {
            id,
            active: true,
            createdAt: 'datetime()',
            createdByUserId: 'system',
            canCreateFileNode: true,
            canCreateOrg: true,
            canReadOrgs: true,
            canReadUsers: true,
            canCreateLang: true,
            canReadLangs: true,
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
            canDeleteOwnUser: true,
            canDeleteLocation: true,
            owningOrgId: 'Seed Company',
            isAdmin: true,
          }),
          relation('out', '', 'email', {
            active: true,
            createdAt: 'datetime()',
          }),
          node('email', 'EmailAddress:Property', {
            active: true,
            value: input.email,
            createdAt: 'datetime()',
          }),
        ],
        [
          node('user'),
          relation('out', '', 'token', {
            active: true,
            createdAt: 'datetime()',
          }),
          node('token'),
        ],
        [
          node('user'),
          relation('out', '', 'password', {
            active: true,
            createdAt: 'datetime()',
          }),
          node('password', 'Property', {
            active: true,
            value: pash,
          }),
        ],
        [
          node('user'),
          relation('out', '', 'realFirstName', {
            active: true,
            createdAt: 'datetime()',
          }),
          node('realFirstName', 'Property', {
            active: true,
            value: input.realFirstName,
          }),
        ],
        [
          node('user'),
          relation('out', '', 'realLastName', {
            active: true,
            createdAt: 'datetime()',
          }),
          node('realLastName', 'Property', {
            active: true,
            value: input.realLastName,
          }),
        ],
        [
          node('user'),
          relation('out', '', 'displayFirstName', {
            active: true,
            createdAt: 'datetime()',
          }),
          node('displayFirstName', 'Property', {
            active: true,
            value: input.displayFirstName,
          }),
        ],
        [
          node('user'),
          relation('out', '', 'displayLastName', {
            active: true,
            createdAt: 'datetime()',
          }),
          node('displayLastName', 'Property', {
            active: true,
            value: input.displayLastName,
          }),
        ],
        ...(input.phone
          ? [
              [
                node('user'),
                relation('out', '', 'phone', {
                  active: true,
                  createdAt: 'datetime()',
                }),
                node('phone', 'Property', {
                  active: true,
                  value: input.phone,
                }),
              ],
            ]
          : []),
        ...(input.timezone
          ? [
              [
                node('user'),
                relation('out', '', 'timezone', {
                  active: true,
                  createdAt: 'datetime()',
                }),
                node('timezone', 'Property', {
                  active: true,
                  value: input.timezone,
                }),
              ],
            ]
          : []),
        ...(input.bio
          ? [
              [
                node('user'),
                relation('out', '', 'bio', {
                  active: true,
                  createdAt: 'datetime()',
                }),
                node('bio', 'Property', {
                  active: true,
                  value: input.bio,
                }),
              ],
            ]
          : []),
        [
          node('user'),
          relation('in', '', 'member'),
          node('acl', 'ACL', {
            canReadRealFirstName: true,
            canEditRealFirstName: true,
            canReadRealLastName: true,
            canEditRealLastName: true,
            canReadDisplayFirstName: true,
            canEditDisplayFirstName: true,
            canReadDisplayLastName: true,
            canEditDisplayLastName: true,
            canReadPassword: true,
            canEditPassword: true,
            canReadEmail: true,
            canEditEmail: true,
            canReadEducationList: true,
            canEditEducation: true,
            canReadPhone: true,
            canEditPhone: true,
            canReadTimezone: true,
            canEditTimezone: true,
            canReadBio: true,
            canEditBio: true,
            canReadFile: true,
            canEditFile: true,
            canCreateFile: true,
          }),
          relation('out', '', 'toNode'),
          node('user'),
        ],
      ])
      .return({
        user: [{ id: 'id' }],
      })
      .run();

    return this.readOne(id, session);
  }

  async readOne(id: string, session: ISession): Promise<User> {
    const result = await this.db.readProperties({
      id,
      session,
      props: [
        'email',
        'realFirstName',
        'realLastName',
        'displayFirstName',
        'displayLastName',
        'phone',
        'timezone',
        'bio',
        'createdAt',
        'id',
      ],
      nodevar: 'user',
    });

    if (!result) {
      throw new NotFoundException(`Could not find user`);
    }
    let user = result as any;
    user.id = result.id.value;
    user.createdAt = result.createdAt.value;
    user = user as User;

    return user;
  }

  async update(input: UpdateUser, session: ISession): Promise<User> {
    const user = await this.readOne(input.id, session);

    return this.db.updateProperties({
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
      throw e;
    }
  }
}
