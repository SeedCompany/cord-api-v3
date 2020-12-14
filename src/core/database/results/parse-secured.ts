import { mapValues } from 'lodash';
import type { DbBaseNodeLabel, Secured } from '../../../common';
import type { Role } from '../../../components/authorization';
import { permissionFor } from '../../../components/authorization/authorization.service';
import {
  parsePermissions,
  permissionDefaults,
  PermListDbResult,
} from './parse-permissions';
import { parsePropList, PropListDbResult } from './parse-props';
import { Nodes } from './types';

const propertyDefaults = {
  value: undefined,
  ...permissionDefaults,
};

/**
 * Parses secured properties from a DB result's propList & permList.
 *
 * The propKeys are passed in to determine the keys of the resulting object.
 * This allows default values to be given when the DB result doesn't include them.
 *
 * @param propList This can straight from the DB result, or an object already
 *                 ran through the `parsePropList` function.
 * @param permNodes The list of permission nodes from the DB result.
 * @param propKeys An object that defines the keys of the result object.
 *                 The values are currently unused.
 */
export const parseSecuredProperties = <
  DbProps extends Record<string, any>,
  PickedKeys extends keyof DbProps
>(
  propList: PropListDbResult<DbProps> | DbProps,
  permNodes: PermListDbResult<DbProps>,
  propKeys: Record<PickedKeys, boolean>
) => {
  const props = Array.isArray(propList) ? parsePropList(propList) : propList;

  const perms = parsePermissions(permNodes);

  const merged = mapValues(propKeys, (_, key: PickedKeys) => {
    const res = {
      ...propertyDefaults,
      ...(perms[key] ?? {}),
    };
    return res.canRead ? { ...res, value: props[key] } : res;
  });
  return (merged as unknown) as { [K in PickedKeys]: Secured<DbProps[K]> };
};

export const parseSecuredProperties2 = <
  DbProps extends Record<string, any>,
  PickedKeys extends keyof DbProps
>(
  propList: PropListDbResult<DbProps> | DbProps,
  roleNodes: Nodes<{ value: Role }>,
  baseNodeLabel: DbBaseNodeLabel,
  propKeys: Record<PickedKeys, boolean>
) => {
  const props = Array.isArray(propList) ? parsePropList(propList) : propList;

  const roles = roleNodes.map((n) => n.properties.value);

  const merged = mapValues(propKeys, (_, key: PickedKeys & string) => {
    const res = {
      ...propertyDefaults,
      canRead: permissionFor(roles, baseNodeLabel, key, 'read'),
      canEdit: permissionFor(roles, baseNodeLabel, key, 'write'),
    };
    return res.canRead ? { ...res, value: props[key] } : res;
  });
  return (merged as unknown) as { [K in PickedKeys]: Secured<DbProps[K]> };
};
