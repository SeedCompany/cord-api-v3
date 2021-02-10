/* eslint-disable no-case-declarations */
import { Injectable } from '@nestjs/common';
import { Connection, node, relation } from 'cypher-query-builder';
import { groupBy, mapValues, pickBy, union, without } from 'lodash';
import { ServerException, Session } from '../../common';
import { retry } from '../../common/retry';
import { ConfigService, DatabaseService, ILogger, Logger } from '../../core';
import {
  parseSecuredPropertiesNew,
  PropListDbResult,
} from '../../core/database/results';
import { InternalRole, Role } from './dto';
import { Powers } from './dto/powers';
import { MissingPowerException } from './missing-power.exception';
import { DbRole, OneBaseNode } from './model';
import { DbBaseNode } from './model/db-base-node.model';
import { everyRole } from './roles';

export interface UserPropertyPermissions {
  [x: string]: { canRead: boolean; canEdit: boolean };
}
export type DbProps = Record<string, any>;
export type PickedKeys = keyof DbProps;

export const permissionDefaults = {
  canRead: false,
  canEdit: false,
};
export type Permission = typeof permissionDefaults;

@Injectable()
export class AuthorizationService {
  constructor(
    private readonly db: DatabaseService,
    private readonly dbConn: Connection,
    private readonly config: ConfigService,
    @Logger('authorization:service') private readonly logger: ILogger
  ) {}

  async processNewBaseNode(
    baseNodeObj: OneBaseNode,
    baseNodeId: string,
    creatorUserId: string
  ) {
    const label = baseNodeObj.__className.substring(2);
    const process = async () => {
      await retry(
        async () => {
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
        },
        {
          retries: 3,
        }
      );
    };

    const tx = this.dbConn.currentTransaction;
    if (!tx) {
      await process();
      return;
    }

    // run procedure after transaction finishes committing so data is actually
    // available for procedure code to use.
    const origCommit = tx.commit.bind(tx);
    tx.commit = async () => {
      await origCommit();
      await process();
    };
  }

  async getPerms(
    baseNode: DbBaseNode,
    userRoles: DbRole[]
  ): Promise<UserPropertyPermissions> {
    const userRoleList = userRoles.map((g) => g.grants);
    const userRoleListFlat = userRoleList.flat(1);
    const objGrantList = userRoleListFlat.filter(
      (g) => g.__className === baseNode.__className
    );
    const propList = objGrantList.map((g) => g.properties).flat(1);
    const byProp = groupBy(propList, 'propertyName');

    // Merge together the results of each property
    const permissions = mapValues(
      byProp,
      (nodes): Permission => {
        const possibilities = nodes.map((node) =>
          // Convert the db properties to API properties.
          // Only keep true values, so merging the objects doesn't replace a true with false
          pickBy({
            canRead: node.permission.read || null,
            canEdit: node.permission.write || null,
          })
        );
        // Merge the all the true permissions together, otherwise default to false
        return Object.assign({}, permissionDefaults, ...possibilities);
      }
    );
    return permissions;
  }

  async getPermissionsOfBaseNode({
    baseNode,
    sessionOrUserId,
    propList,
    propKeys,
  }: {
    baseNode: DbBaseNode;
    sessionOrUserId: Session | string;
    propList: PropListDbResult<DbProps> | DbProps;
    propKeys: Record<PickedKeys, boolean>;
  }): Promise<any> {
    const dbRoles =
      typeof sessionOrUserId === 'string'
        ? await this.getUserRoleObjects(sessionOrUserId)
        : sessionOrUserId.roles;
    const permsOfBaseNode = await this.getPerms(baseNode, dbRoles);
    return parseSecuredPropertiesNew(propList, propKeys, permsOfBaseNode);
  }

  mapRoleToDbRoles(role: Role): InternalRole[] {
    switch (role) {
      case Role.FinancialAnalyst:
        return [
          'FinancialAnalystOnGlobalRole',
          'FinancialAnalystOnProjectRole',
        ];
      case Role.ProjectManager:
        return ['ProjectManagerGlobalRole', 'ProjectManagerOnProjectRole'];
      case Role.RegionalDirector:
        return ['RegionalDirectorGlobalRole', 'RegionalDirectorOnProjectRole'];
      default:
        return [(role + 'Role') as InternalRole];
    }
  }

  async roleAddedToUser(id: string, roles: Role[]) {
    // todo: this only applies to global roles, the only kind we have until next week
    // iterate through all roles and assign to all SGs with that role

    for (const role of roles.flatMap((role) => this.mapRoleToDbRoles(role))) {
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

    for (const role of roles) {
      // match the role to a real role object and grant powers
      const roleObj = everyRole.find((i) => i.name === role);
      if (roleObj === undefined) continue;
      for (const power of roleObj.powers) {
        await this.grantPower(power, id);
      }
    }
  }

  async checkPower(power: Powers, session: Session): Promise<void> {
    const id = session.userId;

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
    const hasPower = result?.hasPower ?? false;

    if (!hasPower) {
      throw new MissingPowerException(
        power,
        `user ${
          session.anonymous ? id : 'anon'
        } does not have the requested power: ${power}`
      );
    }
  }

  async readPower(session: Session): Promise<Powers[]> {
    if (session.anonymous) {
      return [];
    }
    return await this.readPowerByUserId(session.userId);
  }

  async createPower(
    userId: string,
    power: Powers,
    session: Session
  ): Promise<void> {
    const requestingUserPowers = await this.readPowerByUserId(session.userId);
    if (!requestingUserPowers.includes(Powers.GrantPower)) {
      throw new MissingPowerException(
        Powers.GrantPower,
        'user does not have the power to grant power to others'
      );
    }

    await this.grantPower(power, userId);
  }

  async deletePower(
    userId: string,
    power: Powers,
    session: Session
  ): Promise<void> {
    const requestingUserPowers = await this.readPowerByUserId(session.userId);
    if (!requestingUserPowers.includes(Powers.GrantPower)) {
      throw new MissingPowerException(
        Powers.GrantPower,
        'user does not have the power to remove power from others'
      );
    }

    await this.removePower(power, userId);
  }

  async grantPower(power: Powers, userId: string): Promise<void> {
    const powers = await this.readPowerByUserId(userId);

    const newPowers = union(powers, [power]);
    await this.updateUserPowers(userId, newPowers);
  }

  async removePower(power: Powers, userId: string): Promise<void> {
    const powers = await this.readPowerByUserId(userId);

    const newPowers = without(powers, power);
    await this.updateUserPowers(userId, newPowers);
  }

  private async updateUserPowers(
    userId: string,
    newPowers: Powers[]
  ): Promise<void> {
    const result = await this.db
      .query()
      .optionalMatch([node('userOrSg', 'User', { id: userId })])
      .setValues({ 'userOrSg.powers': newPowers })
      .with('*')
      .optionalMatch([node('userOrSg', 'SecurityGroup', { id: userId })])
      .setValues({ 'userOrSg.powers': newPowers })
      .run();

    if (!result) {
      throw new ServerException('Failed to grant power');
    }
  }

  private async readPowerByUserId(id: string): Promise<Powers[]> {
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

  async getUserRoleObjects(id: string): Promise<DbRole[]> {
    const roleQuery = await this.db
      .query()
      .match([
        node('user', 'User', { id }),
        relation('out', '', 'roles', { active: true }),
        node('role', 'Property'),
      ])
      .raw(`RETURN collect(role.value) as roles`)
      .first();

    const roles = roleQuery?.roles.map((role: string) => {
      return everyRole.find((roleObj) => role === roleObj.name);
    });

    return roles;
  }
}
