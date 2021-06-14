import { Injectable } from '@nestjs/common';
import { Connection } from 'cypher-query-builder';
import {
  compact,
  keyBy,
  last,
  mapValues,
  startCase,
  union,
  without,
} from 'lodash';
import {
  getParentTypes,
  has,
  ID,
  isIdLike,
  isSecured,
  keys,
  mapFromList,
  ResourceShape,
  SecuredResource,
  Sensitivity,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../common';
import { retry } from '../../common/retry';
import { ConfigService, ILogger, Logger } from '../../core';
import { ChangesOf, isRelation } from '../../core/database/changes';
import {
  DbPropsOfDto,
  parseSecuredProperties,
  PropListDbResult,
} from '../../core/database/results';
import { AuthorizationRepository } from './authorization.repository';
import { InternalRole, Role, rolesForScope, ScopedRole } from './dto';
import { Powers } from './dto/powers';
import { MissingPowerException } from './missing-power.exception';
import { Action, DbRole, PermissionsForResource } from './model';
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
    private readonly dbConn: Connection,
    private readonly config: ConfigService,
    private readonly repo: AuthorizationRepository,
    @Logger('authorization:service') private readonly logger: ILogger
  ) {}

  async processNewBaseNode(
    resource: ResourceShape<any>,
    baseNodeId: ID,
    creatorUserId: ID
  ) {
    await this.afterTransaction(async () => {
      await this.repo.processNewBaseNode(
        resource.name,
        baseNodeId,
        creatorUserId
      );
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
      otherRoles,
      props
    );
    // @ts-expect-error not matching for some reason but declared return type is correct
    return parseSecuredProperties(props, permissions, resource.SecuredProps);
  }

  async verifyCanEditChanges<TResource extends ResourceShape<any>>(
    resource: TResource,
    baseNode: TResource['prototype'],
    changes: ChangesOf<TResource['prototype']>,
    pathPrefix?: string | null
  ) {
    for (const prop of keys(changes)) {
      await this.verifyCanEdit({
        resource,
        baseNode,
        ...(isRelation(prop, baseNode)
          ? { prop: prop.slice(0, -2), propPath: prop }
          : { prop }),
        pathPrefix: pathPrefix,
      });
    }
  }

  async verifyCanEdit<
    TResource extends ResourceShape<any>,
    Key extends keyof TResource['prototype'] & string
  >({
    resource,
    baseNode,
    prop,
    propName,
    propPath,
    pathPrefix: pathPrefixProp,
  }: {
    resource: TResource;
    baseNode: Partial<TResource['prototype']>;
    prop: Key;
    /** @deprecated Use propPath instead */
    propName?: string;
    propPath?: string;
    pathPrefix?: string | null;
  }) {
    if (!isSecured(baseNode[prop]) || baseNode[prop].canEdit) {
      return;
    }
    const pathPrefix =
      pathPrefixProp ?? pathPrefixProp === null
        ? null
        : // Guess the input field path based on name convention
          last(startCase(resource.name).split(' '))!.toLowerCase();
    const path = propPath ?? propName ?? prop;
    const fullPath = compact([pathPrefix, path]).join('.');
    throw new UnauthorizedException(
      `You do not have permission to update ${resource.name}.${path}`,
      fullPath
    );
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
    otherRoles: ScopedRole[] = [],
    dto?: Resource['prototype']
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
      Object.entries(normalizeGrants(role)).flatMap(([name, grant]) => {
        if (resources.includes(name)) {
          const filtered = mapValues(grant, (propPerm, key) => {
            return this.isSensitivityAllowed(
              propPerm,
              resource,
              key,
              dto?.sensitivity
            )
              ? propPerm
              : {};
          });
          return filtered;
        }
        return [];
      })
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

  isSensitivityAllowed<TResource extends ResourceShape<any>>(
    grant: Partial<
      Record<Action, boolean> & Record<'sensitivityAccess', Sensitivity>
    >,
    resource: TResource,
    prop: string,
    sensitivity?: Sensitivity
  ): boolean {
    if (grant.sensitivityAccess && !sensitivity) {
      throw new ServerException(
        `Sensitivity check required, but no sensitivity provided ${resource.name}.${prop}`
      );
    }

    const sensitivityRank = { High: 3, Medium: 2, Low: 1 };
    return !(
      sensitivity &&
      grant.sensitivityAccess &&
      sensitivityRank[sensitivity] > sensitivityRank[grant.sensitivityAccess]
    );
  }

  async roleAddedToUser(id: ID | string, roles: Role[]) {
    await this.afterTransaction(() => this.doRoleAddedToUser(id, roles));
  }

  private async doRoleAddedToUser(id: ID | string, roles: Role[]) {
    // todo: this only applies to global roles, the only kind we have until next week
    // iterate through all roles and assign to all SGs with that role

    for (const role of roles.flatMap((role) => this.mapRoleToDbRoles(role))) {
      await this.repo.addUserToSecurityGroup(id, role);
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

    const hasPower = await this.repo.hasPower(power, session, id);
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
    return await this.repo.readPowerByUserId(session.userId);
  }

  async createPower(
    userId: ID,
    power: Powers,
    session: Session
  ): Promise<void> {
    const powers = await this.repo.readPowerByUserId(session.userId);
    if (!powers.includes(Powers.GrantPower)) {
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
    const powers = await this.repo.readPowerByUserId(session.userId);
    if (!powers.includes(Powers.GrantPower)) {
      throw new MissingPowerException(
        Powers.GrantPower,
        'user does not have the power to remove power from others'
      );
    }

    await this.removePower(power, userId);
  }

  async grantPower(power: Powers, userId: ID | string): Promise<void> {
    const powers = await this.repo.readPowerByUserId(userId);

    const newPowers = union(powers, [power]);
    await this.repo.updateUserPowers(userId, newPowers);
  }

  async removePower(power: Powers, userId: ID): Promise<void> {
    const powers = await this.repo.readPowerByUserId(userId);

    const newPowers = without(powers, power);
    await this.repo.updateUserPowers(userId, newPowers);
  }

  async getUserGlobalRoles(id: ID): Promise<ScopedRole[]> {
    const roles = await this.repo.getUserGlobalRoles(id);
    const scopedRoles = compact(roles.map(rolesForScope('global')));
    return scopedRoles;
  }
}
