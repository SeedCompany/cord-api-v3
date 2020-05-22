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
import { QueryService } from '../../core/query/query.service';

@Injectable()
export class UserService {
  constructor(
    private readonly auth: AuthorizationService,
    private readonly educations: EducationService,
    private readonly organizations: OrganizationService,
    private readonly unavailabilities: UnavailabilityService,
    private readonly db: DatabaseService,
    private readonly db2: QueryService,
    @Logger('user:service') private readonly logger: ILogger
  ) {}

  @OnIndex()
  async createIndexes() {
    await this.db2.createPropertyExistenceConstraintOnNodeAndRun('User', 'id');
    await this.db2.createPropertyExistenceConstraintOnNodeAndRun(
      'BaseNode',
      'active'
    );
    await this.db2.createPropertyExistenceConstraintOnNodeAndRun(
      'BaseNode',
      'createdAt'
    );
    // await this.db2.createPropertyExistenceConstraintOnNodeAndRun(
    //   'User',
    //   'owningOrgId'
    // );
    await this.db2.createPropertyExistenceConstraintOnNodeAndRun(
      'EmailAddress',
      'value'
    );
    await this.db2.createPropertyExistenceConstraintOnRelationshipAndRun(
      'email',
      'active'
    );
    await this.db2.createPropertyExistenceConstraintOnRelationshipAndRun(
      'email',
      'createdAt'
    );
    await this.db2.createPropertyExistenceConstraintOnRelationshipAndRun(
      'password',
      'active'
    );
    await this.db2.createPropertyExistenceConstraintOnRelationshipAndRun(
      'password',
      'createdAt'
    );
    await this.db2.createPropertyExistenceConstraintOnNodeAndRun(
      'Property',
      'active'
    );
    await this.db2.createPropertyExistenceConstraintOnNodeAndRun(
      'Property',
      'value'
    );
    await this.db2.createPropertyUniquenessConstraintOnNodeAndRun(
      'BaseNode',
      'id'
    );
    await this.db2.createPropertyUniquenessConstraintOnNodeAndRun(
      'EmailAddress',
      'value'
    );
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
    const userId = await this.create(input);
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
    input: CreateUser
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    // session: ISession = {} as ISession
  ): Promise<string> {
    // ensure token doesn't have any users attached to it
    // if (!_.isEmpty(session)) {
    //   await this.logout(session.token);
    // }

    const id = generate();
    this.logger.info('id:' + id);
    const pash = await argon2.hash(input.password);
    const createdAt = DateTime.local();

    const result = await this.db2.createBaseNode(
      {
        label: 'User',
        id,
        createdAt: createdAt.toString(),
        props: [
          {
            key: 'email',
            value: input.email,
            labels: ['Property', 'EmailAddress'],
            addToAdminSg: true,
            addToReaderSg: true,
          },
          {
            key: 'realFirstName',
            value: input.realFirstName,
            labels: ['Property'],
            addToAdminSg: true,
            addToReaderSg: false,
          },
          {
            key: 'realLastName',
            value: input.realLastName,
            labels: ['Property'],
            addToAdminSg: true,
            addToReaderSg: false,
          },
          {
            key: 'displayFirstName',
            value: input.displayFirstName,
            labels: ['Property'],
            addToAdminSg: true,
            addToReaderSg: true,
          },
          {
            key: 'displayLastName',
            value: input.displayLastName,
            labels: ['Property'],
            addToAdminSg: true,
            addToReaderSg: true,
          },
          {
            key: 'phone',
            value: input.phone,
            labels: ['Property'],
            addToAdminSg: true,
            addToReaderSg: false,
          },
          {
            key: 'timezone',
            value: input.timezone,
            labels: ['Property'],
            addToAdminSg: true,
            addToReaderSg: false,
          },
          {
            key: 'bio',
            value: input.bio,
            labels: ['Property'],
            addToAdminSg: true,
            addToReaderSg: true,
          },
          {
            key: 'password',
            value: pash,
            labels: ['Property'],
            addToAdminSg: true,
            addToReaderSg: false,
          },
        ],
      },
      id, // the user being created is the 'requesting user'
      true
    );

    return result;
  }

  async readOne(id: string, session: ISession): Promise<User> {
    const result = await this.db2.readBaseNode(
      {
        label: 'User',
        id,
        createdAt: '',
        props: [
          {
            key: 'email',
            value: '',
            labels: ['Property', 'EmailAddress'],
            addToAdminSg: true,
            addToReaderSg: true,
          },
          {
            key: 'realFirstName',
            value: '',
            labels: ['Property'],
            addToAdminSg: true,
            addToReaderSg: false,
          },
          {
            key: 'realLastName',
            value: '',
            labels: ['Property'],
            addToAdminSg: true,
            addToReaderSg: false,
          },
          {
            key: 'displayFirstName',
            value: '',
            labels: ['Property'],
            addToAdminSg: true,
            addToReaderSg: true,
          },
          {
            key: 'displayLastName',
            value: '',
            labels: ['Property'],
            addToAdminSg: true,
            addToReaderSg: true,
          },
          {
            key: 'phone',
            value: '',
            labels: ['Property'],
            addToAdminSg: true,
            addToReaderSg: false,
          },
          {
            key: 'timezone',
            value: '',
            labels: ['Property'],
            addToAdminSg: true,
            addToReaderSg: false,
          },
          {
            key: 'bio',
            value: '',
            labels: ['Property'],
            addToAdminSg: true,
            addToReaderSg: true,
          },
          {
            key: 'password',
            value: '',
            labels: ['Property'],
            addToAdminSg: true,
            addToReaderSg: false,
          },
        ],
      },
      session.userId
    );

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
