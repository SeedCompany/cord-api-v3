/* eslint-disable no-case-declarations */
import { Injectable } from '@nestjs/common';
import { Connection, node, relation } from 'cypher-query-builder';
import { compact, difference, keyBy, mapValues } from 'lodash';
import {
  getParentTypes,
  has,
  many,
  Many,
  mapFromList,
  ResourceShape,
  SecuredResource,
  Session,
} from '../../common';
import { retry } from '../../common/retry';
import { ConfigService, DatabaseService, ILogger, Logger } from '../../core';
import {
  DbPropsOfDto,
  parseSecuredProperties,
  PropListDbResult,
} from '../../core/database/results';
import { Role, rolesForScope, ScopedRole } from './dto';
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

  async secureProperties<Resource extends ResourceShape<any>>(
    resource: Resource,
    props:
      | PropListDbResult<DbPropsOfDto<Resource['prototype']>>
      | DbPropsOfDto<Resource['prototype']>,
    sessionOrUserId: Session | string,
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
    sessionOrUserId: Session | string,
    otherRoles: ScopedRole[] = []
  ): Promise<PermissionsOf<SecuredResource<Resource>>> {
    const userGlobalRoles =
      typeof sessionOrUserId === 'string'
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

  async verifyPower(powers: Many<Powers>, session: Session): Promise<void> {
    const availablePowers = await this.readPower(session);

    const missing = difference(many(powers), availablePowers);

    if (missing.length > 0) {
      throw new MissingPowerException(
        missing[0],
        `User does not have the requested power(s): ${missing.join(', ')}`
      );
    }
  }

  async readPower(session: Session): Promise<Powers[]> {
    return getDbRoles(session.roles).flatMap((dbRole) => dbRole.powers);
  }

  async getUserGlobalRoles(id: string): Promise<ScopedRole[]> {
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
