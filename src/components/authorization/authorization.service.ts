/* eslint-disable no-case-declarations */
import { Injectable } from '@nestjs/common';
import { Connection, node, relation } from 'cypher-query-builder';
import { compact, groupBy, mapValues, pickBy, union, without } from 'lodash';
import { ServerException, Session } from '../../common';
import { retry } from '../../common/retry';
import {
  ConfigService,
  DatabaseService,
  ILogger,
  Logger,
  matchProjectContext,
} from '../../core';
import {
  parseSecuredProperties,
  PropListDbResult,
} from '../../core/database/results';
import { InternalRole, Role } from './dto';
import { Powers } from './dto/powers';
import { MissingPowerException } from './missing-power.exception';
import { DbRole, OneBaseNode } from './model';
import { DbBaseNode } from './model/db-base-node.model';
import * as AllRoles from './roles';

const getRole = (role: Role) =>
  Object.values(AllRoles).find((r) => r.name === role);

const getProjectRole = (role: Role) =>
  Object.values(AllRoles).find(
    (r) => r.name === role && r.constructor.name === 'ProjectRole'
  );

export const permissionDefaults = {
  canRead: false,
  canEdit: false,
};

export type Permission = typeof permissionDefaults;

export type PermissionsOf<T> = Record<keyof T, Permission>;

export const allRoles = [];

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

  async getPerms<DbNode extends DbBaseNode>(
    baseNode: DbNode,
    userId: string,
    baseNodeId: string,
    userRoles: DbRole[]
  ): Promise<PermissionsOf<DbNode>> {
    const userRoleList = userRoles.map((g) => g.grants);
    const userRoleListFlat = userRoleList.flat(1);
    const objGrantList = userRoleListFlat.filter(
      (g) => g.__className === baseNode.__className
    );
    const propList = objGrantList.map((g) => g.properties).flat(1);
    const byProp = groupBy(propList, 'propertyName');

    // Global roles
    // Merge together the results of each property
    let permissions = mapValues(
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

    const q = this.db.query();
    if (matchProjectContext(q, baseNode.__className, baseNodeId)) {
      const projRoleQuery = await q
        .match([
          node('projectMember', 'ProjectMember'),
          relation('in', '', 'member'),
          node('project', 'Project'),
        ])
        .with(['projectMember', 'project'])
        .match([
          node('projectMember'),
          relation('out', '', 'user'),
          node('user', 'User', { id: userId }),
        ])
        .with(['user', 'projectMember'])
        .match([
          node('projectMember'),
          relation('out', 'r', 'roles', { active: true }),
          node('props', 'Property'),
        ])
        .raw(`RETURN collect(props.value) as roles`)
        .asResult<{ roles: Role[] }>()
        .first();
      if (projRoleQuery) {
        projRoleQuery.roles = projRoleQuery.roles.flat(1);
        const roles = compact(projRoleQuery.roles.map(getProjectRole));

        const userRoleList = roles.map((g) => g.grants);
        const userRoleListFlat = userRoleList.flat(1);
        const objGrantList = userRoleListFlat.filter(
          (g) => g.__className === baseNode.__className
        );
        const propList = objGrantList.map((g) => g.properties).flat(1);
        const byProp = groupBy(propList, 'propertyName');

        // Global roles
        // Merge together the results of each property
        let projPermissionDefaults = {
          canRead: false,
          canEdit: false,
        };
        // console.log('----- global Permissions');
        // console.log(permissions);

        const projPermissions = mapValues(
          byProp,
          (nodes): Permission => {
            const possibilities = nodes.map((node) => {
              // console.log('--node: ');
              // console.log(node);
              projPermissionDefaults = permissions[node.propertyName];

              // Convert the db properties to API properties.
              // Only keep true values, so merging the objects doesn't replace a true with false
              return pickBy({
                canRead: node.permission.read || null,
                canEdit: node.permission.write || null,
              });
            });
            // Merge the all the true permissions together, otherwise default to whatever is in the global role.
            return Object.assign({}, projPermissionDefaults, ...possibilities);
          }
        );
        // console.log('----- projPermissions');
        // console.log(projPermissions);
        permissions = projPermissions;

        // redo pretty much the same as merge above, just have the default permissions be the permissions that we just set. Somehow
      }
    }

    return permissions as PermissionsOf<DbNode>;
  }

  async getPermissionsOfBaseNode<
    DbProps extends Record<string, any>,
    PickedKeys extends keyof DbProps
  >({
    baseNode,
    sessionOrUserId,
    propList,
    propKeys,
    nodeId,
  }: {
    baseNode: DbBaseNode;
    sessionOrUserId: Session | string;
    propList: PropListDbResult<DbProps> | DbProps;
    propKeys: Record<PickedKeys, boolean>;
    nodeId: string;
  }) {
    const dbRoles =
      typeof sessionOrUserId === 'string'
        ? await this.getUserRoleObjects(sessionOrUserId)
        : sessionOrUserId.roles;
    const userId =
      typeof sessionOrUserId === 'string'
        ? sessionOrUserId
        : sessionOrUserId.userId;
    // ignoring types here because baseNode provides no benefit over propList & propKeys.
    const permsOfBaseNode = (await this.getPerms(
      baseNode,
      userId,
      nodeId,
      dbRoles
    )) as any;
    return parseSecuredProperties(propList, permsOfBaseNode, propKeys);
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
      const roleObj = getRole(role);
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
      .asResult<{ roles: Role[] }>()
      .first();
    const roles = compact(roleQuery?.roles.map(getRole));
    return roles;
  }
}
