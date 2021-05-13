import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { Dictionary } from 'lodash';
import { ID, Session } from '../../common';
import { ConfigService, DatabaseService, ILogger, Logger } from '../../core';
import { QueryWithResult } from '../../core/database/query.overrides';
import { InternalRole, Role } from './dto';
import { Powers } from './dto/powers';
import { OneBaseNode } from './model';

@Injectable()
export class AuthorizationRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Logger('user:repository') private readonly logger: ILogger
  ) {}
  async processNewBaseNode(
    baseNodeObj: OneBaseNode,
    baseNodeId: ID,
    creatorUserId: ID
  ): Promise<void> {
    await this.db
      .query()
      .raw(
        `CALL cord.processNewBaseNode($baseNodeId, $label, $creatorUserId)`,
        {
          baseNodeId,
          label: baseNodeObj.__className.substring(2),
          creatorUserId,
        }
      )
      .run();
  }
  async doRoleAddedToUser(id: ID | string, role: InternalRole) {
    await this.db
      .query()
      .raw(
        `
      call apoc.periodic.iterate(
        "MATCH (u:User {id:'${id}'}), (sg:SecurityGroup {role:'${role}'})
        WHERE NOT (u)<-[:member]-(sg)
        RETURN u, sg",
        "MERGE (u)<-[:member]-(sg)", {batchSize:1000})
      yield batches, total return batches, total
  `
      )
      .run();
  }
  checkPower(
    power: Powers,
    session: Session,
    id: ID
  ): QueryWithResult<{
    hasPower: boolean;
  }> {
    const query = this.db
      .query()
      .match(
        // if anonymous we check the public sg for public powers
        session.anonymous
          ? [
              node('user', 'User', { id }),
              relation('in', '', 'member'),
              node('sg', 'SecurityGroup'),
            ]
          : [
              node('sg', 'PublicSecurityGroup', {
                id: this.config.publicSecurityGroup.id,
              }),
            ]
      )
      .raw('where $power IN sg.powers', { power })
      .raw('return $power IN sg.powers as hasPower')
      .union()
      .match([node('user', 'User', { id })])
      .raw('where $power IN user.powers')
      .raw('return $power IN user.powers as hasPower')
      .asResult<{ hasPower: boolean }>();
    return query;
  }
  async updateUserPowers(
    userId: ID | string,
    newPowers: Powers[]
  ): Promise<Array<Dictionary<any>>> {
    const result = await this.db
      .query()
      .optionalMatch([node('userOrSg', 'User', { id: userId })])
      .setValues({ 'userOrSg.powers': newPowers })
      .with('*')
      .optionalMatch([node('userOrSg', 'SecurityGroup', { id: userId })])
      .setValues({ 'userOrSg.powers': newPowers })
      .run();
    return result;
  }
  async getUserGlobalRoles(
    id: ID
  ): Promise<
    | {
        roles: Role[];
      }
    | undefined
  > {
    const roleQuery = await this.db
      .query()
      .match([
        node('user', 'User', { id }),
        relation('out', '', 'roles', { active: true }),
        node('role', 'Property'),
      ])
      .raw(`RETURN collect(role.value) as roles`)
      .asResult<{ roles: Role[] }>()
      .first();
    return roleQuery;
  }
}
