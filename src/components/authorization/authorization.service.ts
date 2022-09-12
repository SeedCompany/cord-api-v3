import { Injectable } from '@nestjs/common';
import { mapValues, pickBy } from 'lodash';
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
import { DbPropsOfDto } from '../../core/database/results';
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
  constructor(readonly privileges: Privileges) {}

  /**
   * @deprecated Use `Privileges.for(X).secureProps(props)` instead.
   * If you need `otherRoles` or `sensitivity` wrap the object with
   * `withScope` or `withEffectiveSensitivity` respectively.
   */
  async secureProperties<Resource extends ResourceShape<any>>(
    resource: Resource,
    props: DbPropsOfDto<Resource['prototype']>,
    session: Session,
    otherRoles?: ScopedRole[],
    sensitivity?: Sensitivity
  ): Promise<SecuredResource<Resource, false>> {
    props =
      otherRoles && otherRoles.length > 0
        ? withScope(props, otherRoles)
        : props;
    props = sensitivity ? withEffectiveSensitivity(props, sensitivity) : props;
    return this.privileges.for(session, resource, props).secureProps(props);
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

  /**
   * @deprecated Use `Privileges.for(X).can('read')` instead.
   */
  async canList<Resource extends ResourceShape<any>>(
    resource: Resource,
    session: Session
  ): Promise<boolean> {
    return this.privileges.for(session, resource).can('read');
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
    const privileges = this.privileges.for(sessionOrUserId, resource, dto);
    // @ts-expect-error new API is purposefully stricter, but it does handle this legacy API.
    return privileges.all;
  }

  /**
   * @deprecated Use `Privileges.for(X).verifyCan('create')` instead
   */
  async checkPower(power: Power, session: Session): Promise<void> {
    this.privileges.forUser(session).verifyPower(power);
  }
}
