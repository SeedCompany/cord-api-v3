import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { ID, Session } from '../../common';
import { ConfigService, DatabaseService, ILogger, Logger } from '../../core';
import { ACTIVE } from '../../core/database/query';
import { InternalRole, Role } from './dto';
import { Powers } from './dto/powers';

@Injectable()
export class AuthorizationRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Logger('user:repository') private readonly logger: ILogger
  ) {}

  async processNewBaseNode(
    label: string,
    baseNodeId: ID,
    creatorUserId: ID
  ): Promise<void> {
    await this.db
      .query()
      .raw(
        `CALL cord.processNewBaseNode($baseNodeId, $label, $creatorUserId)`,
        {
          baseNodeId,
          label,
          creatorUserId,
        }
      )
      .run();
  }

  async addUserToSecurityGroup(id: ID | string, role: InternalRole) {
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

  async hasPower(powers: Powers[], session: Session) {
    const query = this.db
      .query()
      .match([node('user', 'User', { id: session.userId })])
      .raw(`WHERE any(userPower in user.powers WHERE userPower IN $powers)`, {
        powers: powers,
      })
      .return<{ hasPower: boolean }>('count(user) > 0 AS hasPower');

    const result = await query.first();
    return result?.hasPower ?? false;
  }

  async updateUserPowers(userId: ID | string, newPowers: Powers[]) {
    await this.db
      .query()
      .optionalMatch([node('user', 'User', { id: userId })])
      .setValues({ 'user.powers': newPowers })
      .run();
  }

  async getUserPowers(id: ID | string) {
    const result = await this.db
      .query()
      .matchNode('user', 'User', { id })
      .return<{ powers: Powers[] }>('user.powers as powers')
      .first();
    return result?.powers ?? [];
  }

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
