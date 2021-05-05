import { ID } from 'aws-sdk/clients/s3';
import { mapValues, keyBy } from 'lodash';
import { Session } from 'node:inspector';
import {
  ResourceShape,
  SecuredResource,
  isIdLike,
  getParentTypes,
  mapFromList,
  Sensitivity,
  has,
} from '../../src/common';
import { ScopedRole } from '../../src/components/authorization';
import { PermissionsOf } from '../../src/components/authorization/authorization.service';
import {
  DbPermission,
  DbRole,
  PermissionsForResource,
} from '../../src/components/authorization/model';
import * as AllRoles from '../../src/components/authorization/roles';

const getDbRoles = (role: ScopedRole) =>
  Object.values(AllRoles).filter((r) => role.includes(r.name));
/**
 * Get the permissions for a resource.
 *
 * @param resource        The resource to pull permissions for,
 *                        this determines the return type
 * @param sessionOrUserId Give session or a user to grab their global roles
 *                        and merge them with the given roles
 * @param otherRoles      Other roles to apply, probably non-global context
 */
export async function getPermissions<Resource extends ResourceShape<any>>({
  resource,
  sessionOrUserId,
  dto,
  userRole,
}: {
  resource: Resource;
  sessionOrUserId: Session | ID;
  dto?: Resource['prototype'];
  userRole: ScopedRole;
}): Promise<PermissionsOf<SecuredResource<Resource>>> {
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

  const dbRoles = getDbRoles(userRole);

  // grab all the grants for the given roles & matching resources
  const grants = dbRoles.flatMap((role) =>
    Object.entries(normalizeGrants(role)).flatMap(([name, grant]) => {
      if (resources.includes(name)) {
        if (
          dto?.sensitivity &&
          !isSensitivityAllowed(grant, dto?.sensitivity)
        ) {
          console.log('Not Allowed');
          return [];
        }
        console.log('Allowed');
        return grant;
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

function isSensitivityAllowed(
  grant: DbPermission,
  sensitivity?: Sensitivity
): boolean {
  const sensitivityRank = { High: 3, Medium: 2, Low: 1 };
  if (
    sensitivity &&
    grant.sensitivityAccess &&
    sensitivityRank[sensitivity] > sensitivityRank[grant.sensitivityAccess]
  ) {
    return false;
  }
  return true;
}
