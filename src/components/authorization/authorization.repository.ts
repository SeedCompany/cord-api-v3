import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { ID } from '../../common';
import { ConfigService, DatabaseService, ILogger, Logger } from '../../core';
import { ACTIVE } from '../../core/database/query';
import { Role } from './dto';

@Injectable()
export class AuthorizationRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Logger('user:repository') private readonly logger: ILogger
  ) {}

  async getUserGlobalRoles(id: ID) {
    const result = await this.db
      .query()
      .match([
        node('user', 'User', { id }),
        relation('out', '', 'roles', ACTIVE),
        node('role', 'Property'),
      ])
      .raw(`RETURN collect(role.value) as roles`)
      .asResult<{ roles: Role[] }>()
      .first();
    return result?.roles ?? [];
  }
}
