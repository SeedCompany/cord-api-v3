import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { ID, Session } from '../../common';
import {
  ConfigService,
  DatabaseService,
  ILogger,
  Logger,
  PostgresService,
} from '../../core';
import { ACTIVE } from '../../core/database/query';
import { InternalRole, Role } from './dto';
import { Powers } from './dto/powers';

@Injectable()
export class AuthorizationRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Logger('user:repository') private readonly logger: ILogger,
    private readonly pg: PostgresService
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

  async hasPower(power: Powers, session: Session, id: ID) {
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

    const result = await query.first();
    return result?.hasPower ?? false;
  }

  async updateUserPowers(userId: ID | string, newPowers: Powers[]) {
    await this.db
      .query()
      .optionalMatch([node('userOrSg', 'User', { id: userId })])
      .setValues({ 'userOrSg.powers': newPowers })
      .with('*')
      .optionalMatch([node('userOrSg', 'SecurityGroup', { id: userId })])
      .setValues({ 'userOrSg.powers': newPowers })
      .run();
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
    const pool = this.pg.pool;

    const rolesOfPerson = await pool.query(
      `select gr.name, grm.person from public.global_role_memberships grm inner join public.global_roles_data gr on gr.id = grm.global_role inner join people_data p on p.id = grm.person 
      where p.neo4j_id = $1`,
      [id]
    );
    const roles: Role[] = [];
    for (let { name } of rolesOfPerson.rows) {
      roles?.push(name);
    }
    // console.log(pgResult);
    console.log('auth.getUserGlobalRoles', {
      pg: roles,
      neo4j: result?.roles ?? [],
    });
    // return roles;
    console.log();
    return result?.roles ?? [];
  }

  async readPowerByUserId(id: ID | string) {
    const result = await this.db
      .query()
      .match([node('user', 'User', { id })])
      .raw('return user.powers as powers')
      .unionAll()
      .match([node('sg', 'SecurityGroup', { id })])
      .raw('return sg.powers as powers')
      .asResult<{ powers?: Powers[] }>()
      .first();
    return result?.powers ?? [];
  }
}
