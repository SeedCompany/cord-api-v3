import { Injectable } from '@nestjs/common';
import { keyBy, mapValues, pickBy } from 'lodash';
import {
  getParentTypes,
  isResourceClass,
  mapFromList,
  ResourceShape,
  SecuredResource,
  Sensitivity,
  Session,
} from '../../common';
import { ChangesOf } from '../../core/database/changes';
import {
  DbPropsOfDto,
  parseSecuredProperties,
} from '../../core/database/results';
import {
  AuthScope,
  GlobalScopedRole,
  Powers as Power,
  ProjectScopedRole,
  ScopedRole,
} from './dto';
import { DbRole } from './model';
import { withEffectiveSensitivity, withScope } from './policies/conditions';
import { Privileges } from './policy';
import * as AllRoles from './roles';

const getDbRoles = (roles: ScopedRole[]): DbRole[] =>
  Object.values(AllRoles).filter((role) => roles.includes(role.name));

const DbRolesForScope = (scope: AuthScope): Record<ScopedRole, DbRole> =>
  mapFromList(Object.values(AllRoles), (role) =>
    role.name.startsWith(scope) ? [role.name, role] : null
  );

export type ProjectRoleSensitivityMapping = {
  [K in ProjectScopedRole]?: Sensitivity;
};

export type GlobalRoleSensitivityMapping = {
  [K in GlobalScopedRole]?: Sensitivity;
};

export type AuthSensitivityMapping =
  | ProjectRoleSensitivityMapping
  | GlobalRoleSensitivityMapping;

export const permissionDefaults = {
  canRead: false,
  canEdit: false,
};
export type Permission = typeof permissionDefaults;

export type PermissionsOf<T> = Record<keyof T & string, Permission>;

@Injectable()
export class AuthorizationService {
  constructor(private readonly privileges: Privileges) {}

  async secureProperties<Resource extends ResourceShape<any>>(
    resource: Resource,
    props: DbPropsOfDto<Resource['prototype']>,
    session: Session,
    otherRoles?: ScopedRole[],
    sensitivity?: Sensitivity
  ): Promise<SecuredResource<Resource, false>> {
    const permissions = await this.getPermissions({
      resource: resource,
      sessionOrUserId: session,
      otherRoles,
      dto: props,
      sensitivity,
    });
    // @ts-expect-error not matching for some reason but declared return type is correct
    return parseSecuredProperties(props, permissions, resource.SecuredProps);
  }

  /**
   * @deprecated Use `Privileges.for(X).verifyChanges(changes)` instead
   */
  async verifyCanEditChanges<TResource extends ResourceShape<any>>(
    resource: TResource,
    baseNode: TResource['prototype'],
    changes: ChangesOf<TResource['prototype']>,
    pathPrefix?: string | null
  ) {
    // @ts-expect-error this function doesn't use session. Not sure if I want to
    // move this function out of its new location or not. Everywhere we call
    // this we have session available, so it shouldn't be a problem.
    const fakeSession: Session = undefined;
    this.privileges
      .for(fakeSession, resource, baseNode)
      .verifyChanges(changes, { pathPrefix });
  }

  async getListRoleSensitivityMapping<Resource extends ResourceShape<any>>(
    resource: Resource,
    scope: AuthScope = 'project'
  ): Promise<AuthSensitivityMapping> {
    // convert resource to a list of resource names to check
    const resources = getParentTypes(resource)
      // if parent defines Props include it in mapping
      .filter(isResourceClass)
      .map((r) => r.name);

    const roleGrantsFiltered = mapValues(DbRolesForScope(scope), (role) =>
      role.grants.find((g) => resources.includes(g.__className.substring(2)))
    );
    const map = mapValues(roleGrantsFiltered, (grant) =>
      grant?.canList ? grant?.sensitivityAccess : null
    );
    return pickBy(map, (sens) => sens !== null);
  }

  async canList<Resource extends ResourceShape<any>>(
    resource: Resource,
    session: Session
  ): Promise<boolean> {
    const userGlobalRoles = session.roles;
    const roles = [...userGlobalRoles];

    // convert resource to a list of resource names to check
    const resources = getParentTypes(resource)
      // if parent defines Props include it in mapping
      .filter(isResourceClass)
      .map((r) => r.name);

    const normalizeGrants = (role: DbRole) =>
      !Array.isArray(role.grants)
        ? role.grants
        : mapValues(
            // convert list of canList permissions keyed by resource name
            keyBy(role.grants, (resourceGrant) =>
              resourceGrant.__className.substring(2)
            ),
            (resourceGrant) => resourceGrant.canList
          );
    const dbRoles = getDbRoles(roles);
    const grants = dbRoles.flatMap((role) =>
      Object.entries(normalizeGrants(role)).flatMap(([name, grant]) => {
        if (resources.includes(name)) {
          return grant;
        }
        return [];
      })
    );
    return grants.some((grant) => grant);
  }

  /**
   * Get the permissions for a resource.
   *
   * @deprecated Use `Privileges.for(X).all` instead.
   * If you need `otherRoles` or `sensitivity` wrap the object with
   * `withScope` or `withEffectiveSensitivity` respectively.
   *
   * @param opt
   * @param opt.resource        The resource to pull permissions for,
   *                            this determines the return type
   * @param opt.sessionOrUserId Give session or a user to grab their global roles
   *                            and merge them with the given roles
   * @param [opt.otherRoles]    Other roles to apply, probably non-global context
   * @param [opt.dto]           The object to in question. Currently, sensitivity is pulled from this.
   * @param [opt.sensitivity]   The sensitivity level to get permissions for.
   */
  async getPermissions<Resource extends ResourceShape<any>>({
    resource,
    sessionOrUserId,
    otherRoles,
    dto = {},
    sensitivity,
  }: {
    resource: Resource;
    sessionOrUserId: Session;
    otherRoles?: ScopedRole[];
    dto?: Resource['prototype'];
    sensitivity?: Sensitivity;
  }): Promise<PermissionsOf<SecuredResource<Resource>>> {
    dto =
      otherRoles && otherRoles.length > 0 ? withScope(dto, otherRoles) : dto;
    dto = sensitivity ? withEffectiveSensitivity(dto, sensitivity) : dto;
    return this.privileges.for(sessionOrUserId, resource, dto).all;
  }

  /**
   * @deprecated Use `Privileges.for(X).verifyCan('create')` instead
   */
  async checkPower(power: Power, session: Session): Promise<void> {
    this.privileges.forUser(session).verifyPower(power);
  }
}
