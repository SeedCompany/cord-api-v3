/* eslint-disable no-case-declarations */
import { Injectable } from '@nestjs/common';
import { Connection, node, relation } from 'cypher-query-builder';
import { compact, keyBy, mapValues, union, without } from 'lodash';
import {
  getParentTypes,
  has,
  ID,
  isIdLike,
  isSecured,
  mapFromList,
  Resource,
  ResourceShape,
  SecuredResource,
  ServerException,
  Session,
  UnauthorizedException,
  unwrapSecured,
  UnwrapSecured,
} from '../../common';
import { retry } from '../../common/retry';
import { ConfigService, DatabaseService, ILogger, Logger } from '../../core';
import {
  DbPropsOfDto,
  parseSecuredProperties,
  PropListDbResult,
} from '../../core/database/results';
import { InternalRole, Role, rolesForScope, ScopedRole } from './dto';
import { Powers } from './dto/powers';
import { MissingPowerException } from './missing-power.exception';
import { DbRole, OneBaseNode, PermissionsForResource } from './model';
import * as AllRoles from './roles';

const getDbRoles = (roles: ScopedRole[]) =>
  Object.values(AllRoles).filter((role) => roles.includes(role.name));

export const permissionDefaults = {
  canRead: false,
  canEdit: false,
};

export type Permission = typeof permissionDefaults;

export type PermissionsOf<T> = Record<keyof T, Permission>;

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
    baseNodeId: ID,
    creatorUserId: ID
  ) {
    await this.afterTransaction(async () => {
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
    });
  }

  /**
   * Run code after current transaction finishes, if there is one.
   * This is a hack to allow our procedure and apoc.periodic.iterate to work
   * without dead-locking. They use separate transactions so they need the
   * resource being modified to be unlocked (which happens after the
   * transaction commits/finishes).
   */
  private async afterTransaction(fn: () => Promise<void>) {
    const process = async () => {
      await retry(fn, {
        retries: 3,
      });
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

  async secureProperties<Resource extends ResourceShape<any>>(
    resource: Resource,
    props:
      | PropListDbResult<DbPropsOfDto<Resource['prototype']>>
      | DbPropsOfDto<Resource['prototype']>,
    sessionOrUserId: Session | ID,
    otherRoles: ScopedRole[] = []
  ): Promise<SecuredResource<Resource, false>> {
    const permissions = await this.getPermissions(
      resource,
      sessionOrUserId,
      otherRoles
    );
    // @ts-expect-error not matching for some reason but declared return type is correct
    return parseSecuredProperties(props, permissions, resource.SecuredProps);
  }

  async verifyCanEditChanges<
    TObject extends Resource,
    Key extends keyof TObject & string
  >(
    baseNode: TObject,
    props: readonly Key[],
    changes: { [Key in keyof TObject]?: UnwrapSecured<TObject[Key]> }
  ) {
    for (const prop of props) {
      if (
        changes[prop] === undefined ||
        unwrapSecured(baseNode[prop]) === changes[prop]
      ) {
        continue;
      }
      await this.verifyCanEdit(baseNode, prop);
    }
  }

  async verifyCanEdit<
    DbNode extends Record<string, any>,
    Key extends keyof DbNode
  >(baseNode: DbNode, prop: Key) {
    if (isSecured(baseNode[prop]) && !baseNode[prop].canEdit) {
      throw new UnauthorizedException(
        'You do not have permission to update this property',
        `${baseNode.__typename as string}.${prop as string}`
      );
    }
  }

  /**
   * Get the permissions for a resource.
   *
   * @param resource        The resource to pull permissions for,
   *                        this determines the return type
   * @param sessionOrUserId Give session or a user to grab their global roles
   *                        and merge them with the given roles
   * @param otherRoles      Other roles to apply, probably non-global context
   */
  async getPermissions<Resource extends ResourceShape<any>>(
    resource: Resource,
    sessionOrUserId: Session | ID,
    otherRoles: ScopedRole[] = []
  ): Promise<PermissionsOf<SecuredResource<Resource>>> {
    const userGlobalRoles = isIdLike(sessionOrUserId)
      ? await this.getUserGlobalRoles(sessionOrUserId)
      : sessionOrUserId.roles;
    const roles = [...userGlobalRoles, ...otherRoles];

    // convert resource to a list of resource names to check
    const resources = getParentTypes(resource)
      // if parent defines Props include it in mapping
      .filter(
        (r) => has('Props', r) && Array.isArray(r.Props) && r.Props.length > 0
      )
      .map((r) => r.name);

    const normalizeGrants = (role: DbRole) =>
      !Array.isArray(role.grants)
        ? role.grants
        : mapValues(
            // convert list of grants to object keyed by resource name
            keyBy(role.grants, (resourceGrant) =>
              resourceGrant.__className.substring(2)
            ),
            (resourceGrant) =>
              // convert value of a grant to an object keyed by prop name and value is a permission set
              mapValues(
                keyBy(resourceGrant.properties, (prop) => prop.propertyName),
                (prop) => prop.permission
              )
          );

    const dbRoles = getDbRoles(roles);

    // grab all the grants for the given roles & matching resources
    const grants = dbRoles.flatMap((role) =>
      Object.entries(normalizeGrants(role)).flatMap(([name, grant]) =>
        resources.includes(name) ? grant : []
      )
    ) as Array<PermissionsForResource<ResourceShape<Resource>>>;

    const keys = [
      ...resource.SecuredProps,
      ...Object.keys(resource.Relations ?? {}),
    ] as Array<keyof Resource & string>;
    return mapFromList(keys, (key) => {
      const value = {
        canRead: grants.some((grant) => grant[key]?.read === true),
        canEdit: grants.some((grant) => grant[key]?.write === true),
      };
      return [key, value];
    }) as PermissionsOf<SecuredResource<Resource>>;
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

  async roleAddedToUser(id: ID | string, roles: Role[]) {
    await this.afterTransaction(() => this.doRoleAddedToUser(id, roles));
  }

  private async doRoleAddedToUser(id: ID | string, roles: Role[]) {
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

    const powers = getDbRoles(roles.map(rolesForScope('global'))).flatMap(
      (dbRole) => dbRole.powers
    );
    for (const power of powers) {
      await this.grantPower(power, id);
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
    userId: ID,
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
    userId: ID,
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

  async grantPower(power: Powers, userId: ID | string): Promise<void> {
    const powers = await this.readPowerByUserId(userId);

    const newPowers = union(powers, [power]);
    await this.updateUserPowers(userId, newPowers);
  }

  async removePower(power: Powers, userId: ID): Promise<void> {
    const powers = await this.readPowerByUserId(userId);

    const newPowers = without(powers, power);
    await this.updateUserPowers(userId, newPowers);
  }

  private async updateUserPowers(
    userId: ID | string,
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

  private async readPowerByUserId(id: ID | string): Promise<Powers[]> {
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

  async getUserGlobalRoles(id: ID): Promise<ScopedRole[]> {
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
    const roles = compact(roleQuery?.roles.map(rolesForScope('global')));
    return roles;
  }
}
