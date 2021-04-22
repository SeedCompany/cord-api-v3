import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { Dictionary } from 'lodash';
import { DateTime } from 'luxon';
import { DuplicateException, ServerException } from '../../common';
import {
  ConfigService,
  DatabaseService,
  ILogger,
  Logger,
  OnIndex,
  property,
  UniquenessError,
} from '../../core';
import { Role } from '../authorization';
import { CreatePerson } from './dto';

@Injectable()
export class UserRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Logger('user:repository') private readonly logger: ILogger
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

  async create(id: string, input: CreatePerson): Promise<Dictionary<any>> {
    const createdAt = DateTime.local();

    const query = this.db.query();
    query.create([
      [
        node('user', ['User', 'BaseNode'], {
          id,
          createdAt,
          email: input.email,
          realFirstName: input.realFirstName,
          realLastName: input.realLastName,
          displayFirstName: input.displayFirstName,
          phone: input.phone,
          timezone: input.timezone,
          about: input.about,
          status: input.status,
          roles: input.roles ?? [],
          title: input.title,
          canDelete: true,
        }),
      ],
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

    return result;
  }
}
