import {
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
  UnauthorizedException as UnauthenticatedException,
} from '@nestjs/common';
import { ForbiddenError } from 'apollo-server-core';
import * as argon2 from 'argon2';
import { node } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ISession } from '../../common';
import {
  DatabaseService,
  ILogger,
  Logger,
  matchSession,
  OnIndex,
} from '../../core';
import { QueryService } from '../../core/query/query.service';
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
import { POWERS } from '../../core/query/model/powers';

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

    // await this.db2.createPropertyExistenceConstraintOnNodeAndRun(
    //   'User',
    //   'owningOrgId'
    // );
    await this.db2.createPropertyExistenceConstraintOnNodeAndRun(
      'Email',
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

    await this.db2.createPropertyUniquenessConstraintOnNodeAndRun(
      'Email',
      'value'
    );
  }

  async list(
    { page, count, sort, order, filter }: UserListInput,
    session: ISession
  ): Promise<UserListOutput> {
    const result: any = await this.db2.listBaseNode(
      {
        id: '',
        createdAt: '',
        label: 'User',
        props: [
          {
            key: 'email',
            value: '',
            isSingleton: true,
            addToAdminSg: true,
            addToReaderSg: true,
            orderBy: true,
            asc: true,
          },
        ],
      },
      session.userId,
      page,
      count,
      sort,
      order,
      'filter me'
    );
    this.logger.info(JSON.stringify(result));

    // const result = await this.db.list<User>({
    //   session,
    //   nodevar: 'user',
    //   aclReadProp: 'canReadUsers',
    //   aclEditProp: 'canCreateUser',
    //   props: [
    //     'email',
    //     'realFirstName',
    //     'realLastName',
    //     'displayFirstName',
    //     'displayLastName',
    //     'phone',
    //     'timezone',
    //     'bio',
    //   ],
    //   input: {
    //     page,
    //     count,
    //     sort,
    //     order,
    //     filter,
    //   },
    // });

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
        (email:Email {
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

    session.userId = userId;

    const loginResult = await this.db2.login(
      session.token,
      input.email,
      input.password
    );

    if (!loginResult) {
      this.logger.error('failed to log in a newly ceated user');
    }

    const result = await this.readOne(userId, session);

    return result;
  }

  async create(
    input: CreateUser,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    session: ISession = {} as ISession
  ): Promise<string> {
    // ensure token doesn't have any users attached to it
    // if (!_.isEmpty(session)) {
    //   await this.logout(session.token);
    // }

    const id = generate();

    const pash = await argon2.hash(input.password);
    const createdAt = DateTime.local();

    const result = await this.db2.createBaseNode(
      {
        label: 'User',
        id,
        createdAt: createdAt.toString(),
        props: [
          {
            key: 'token',
            value: '',
            isSingleton: false,
            addToAdminSg: true,
            addToReaderSg: false,
          },
          {
            key: 'email',
            value: input.email,
            isSingleton: true,
            addToAdminSg: true,
            addToReaderSg: false,
          },
          {
            key: 'realFirstName',
            value: input.realFirstName,
            isSingleton: true,
            addToAdminSg: true,
            addToReaderSg: false,
          },
          {
            key: 'realLastName',
            value: input.realLastName,
            isSingleton: true,
            addToAdminSg: true,
            addToReaderSg: false,
          },
          {
            key: 'displayFirstName',
            value: input.displayFirstName,
            isSingleton: true,
            addToAdminSg: true,
            addToReaderSg: true,
            isOrgReadable: true,
          },
          {
            key: 'displayLastName',
            value: input.displayLastName,
            isSingleton: true,
            addToAdminSg: true,
            addToReaderSg: true,
            isOrgReadable: true,
          },
          {
            key: 'phone',
            value: input.phone,
            isSingleton: true,
            addToAdminSg: true,
            addToReaderSg: false,
          },
          {
            key: 'timezone',
            value: input.timezone,
            isSingleton: true,
            addToAdminSg: true,
            addToReaderSg: false,
            isOrgReadable: true,
            isPublicReadable: true,
          },
          {
            key: 'bio',
            value: input.bio,
            isSingleton: true,
            addToAdminSg: true,
            addToReaderSg: true,
          },
          {
            key: 'password',
            value: pash,
            isSingleton: true,
            addToAdminSg: true,
            addToReaderSg: false,
          },
        ],
      },
      id, // the user being created is the 'requesting user'
      true,
      session.owningOrgId
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
            isSingleton: true,
          },
          {
            key: 'realFirstName',
            value: '',
            isSingleton: true,
          },
          {
            key: 'realLastName',
            value: '',
            isSingleton: true,
          },
          {
            key: 'displayFirstName',
            value: '',
            isSingleton: true,
          },
          {
            key: 'displayLastName',
            value: '',
            isSingleton: true,
          },
          {
            key: 'phone',
            value: '',
            isSingleton: true,
          },
          {
            key: 'timezone',
            value: '',
            isSingleton: true,
          },
          {
            key: 'bio',
            value: '',
            isSingleton: true,
          },
        ],
      },
      session.userId
    );

    if (result) {
      return result;
    } else {
      // todo get public data
      throw new ForbiddenError('Not allowed');

      throw new NotFoundException(`Could not find user`);
    }
  }

  async update(input: UpdateUser, session: ISession): Promise<User> {
    if (!session.userId) {
      throw new UnauthenticatedException();
    }
    const createdAt = DateTime.local();
    await this.db2.updateBaseNode(
      {
        label: 'User',
        id: input.id,
        createdAt: createdAt.toString(),
        props: [
          {
            key: 'realFirstName',
            value: input.realFirstName,
            isSingleton: true,
          },
          {
            key: 'realLastName',
            value: input.realLastName,
            isSingleton: true,
          },
          {
            key: 'displayFirstName',
            value: input.displayFirstName,
            isSingleton: true,
          },
          {
            key: 'displayLastName',
            value: input.displayLastName,
            isSingleton: true,
          },
          {
            key: 'phone',
            value: input.phone,
            isSingleton: true,
          },
          {
            key: 'timezone',
            value: input.timezone,
            isSingleton: true,
          },
          {
            key: 'bio',
            value: input.bio,
            isSingleton: true,
          },
        ],
      },
      session.userId
    );

    const updatedUser = await this.readOne(input.id, session);
    return updatedUser;
  }

  async delete(id: string, session: ISession): Promise<void> {
    const user = await this.readOne(id, session);
    try {
      if (session.userId) {
        await this.db2.deleteBaseNode(
          id,
          session.userId,
          'User',
          POWERS.DELETE_USER
        );
      } else {
        this.logger.error('no user id provided');
      }
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
}
