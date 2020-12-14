import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DbBaseNodeLabel, NotFoundException } from '../../common';
import { ConfigService, DatabaseService, ILogger, Logger } from '../../core';
import { matchPropList } from '../../core/database/query';
import { AuthorizationService } from '../authorization/authorization.service';
import { User, UserStatus } from './dto';

@Injectable()
export class UserRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly auth: AuthorizationService,
    @Logger('user:repository') private readonly logger: ILogger
  ) {}

  async read(userId: string, requestingUserId: string): Promise<User> {
    const result = await this.db
      .query()
      .match([
        node('requestingUser', 'User', { id: requestingUserId }),
        relation('out', '', 'roles', { active: true }),
        node('role', 'Property'),
      ])
      .match([node('node', 'User', { id: userId })])
      .call(matchPropList)
      .raw('return propList')
      .first();

    console.log(result);
    if (!result) {
      throw new NotFoundException('Could not find user', 'user.id');
    }

    return {
      about: {
        value: this.auth.perm(
          result.roles,
          DbBaseNodeLabel.User,
          'about',
          'read'
        )
          ? result.about ?? null
          : null,
        canRead: this.auth.perm(
          result.roles,
          DbBaseNodeLabel.User,
          'about',
          'read'
        ),
        canEdit: this.auth.perm(
          result.roles,
          DbBaseNodeLabel.User,
          'about',
          'write'
        ),
      },
      canDelete: true,
      createdAt: result.asdf,
      displayFirstName: {
        value: 'asdf',
        canRead: true,
        canEdit: true,
      },
      displayLastName: {
        value: 'asdf',
        canRead: true,
        canEdit: true,
      },
      email: {
        value: 'asdf',
        canRead: true,
        canEdit: true,
      },
      id: result.user.properties.id ?? null,
      phone: {
        value: 'asdf',
        canRead: true,
        canEdit: true,
      },
      realFirstName: {
        value: 'asdf',
        canRead: true,
        canEdit: true,
      },
      realLastName: {
        value: 'asdf',
        canRead: true,
        canEdit: true,
      },
      roles: {
        value: [],
        canRead: true,
        canEdit: true,
      },
      status: {
        value: UserStatus.Active,
        canRead: true,
        canEdit: true,
      },
      timezone: {
        value: 'asdf',
        canRead: true,
        canEdit: true,
      },
      title: {
        value: 'asdf',
        canRead: true,
        canEdit: true,
      },
    };
  }
}
