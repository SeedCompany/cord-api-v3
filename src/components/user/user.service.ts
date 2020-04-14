import { Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ISession } from '../../common';
import { DatabaseService, ILogger, Logger, OnIndex } from '../../core';
import { LoginInput } from '../authentication/authentication.dto';
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

  async isEmailUnique(id: string, session: ISession): Promise<boolean> {
    const isUnique = await this.db.isPropertyUnique({
      id,
      session,
      baseNodeLabel: 'User',
      propName: 'email',
    });
    return isUnique;
  }

  // stolen from authentication service, need to DRY it
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

    try {
      if (result1 === undefined) {
        throw Error('Email or Password are incorrect');
      }
      if (await argon2.verify(result1.pash, input.password)) {
        // password match
      } else {
        // password did not match
        throw Error('Email or Password are incorrect');
      }
    } catch (err) {
      // internal failure
      this.logger.error('Login failed', { exception: err });
      throw err;
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

    if (result2 === undefined) {
      throw Error('Login failed. Please contact your administrator.');
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
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  async create(
    input: CreateUser,
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

    const result = await this.db
      .query()
      .create([
        [
          node('user', 'User', {
            id,
            active: true,
            createdAt,
            createdByUserId: 'system',
            canCreateBudget: true,
            canReadBudgets: true,
            canCreateBudgetRecord: true,
            canReadBudgetRecords: true,
            canCreateFileNode: true,
            canReadFileNodes: true,
            canCreateFileVersion: true,
            canReadFileVersions: true,
            canCreateDirectory: true,
            canReadDirectorys: true,
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
            canCreateCeremony: true,
            canReadCeremonies: true,
            canCreateProjectMember: true,
            canReadProjectMembers: true,
            canCreateEngagement: true,
            canReadEngagements: true,
            canDeleteOwnUser: true,
            canDeleteLocation: true,
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
          }),
          relation('out', '', 'toNode'),
          node('user'),
        ],
      ])
      .return({
        user: [{ id: 'id' }],
      })
      .first();

    if (!result) {
      throw Error('failed to create user');
    } else {
      return result.id;
    }
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
