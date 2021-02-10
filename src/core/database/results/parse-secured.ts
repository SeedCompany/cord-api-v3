import { mapValues } from 'lodash';
import type { Secured } from '../../../common';
import {
  permissionDefaults,
  PermissionsOf,
} from '../../../components/authorization/authorization.service';
import { parsePropList, PropListDbResult } from './parse-props';

/**
 * Parses secured properties from a DB result's propList & permList.
 *
 * The propKeys are passed in to determine the keys of the resulting object.
 * This allows default values to be given when the DB result doesn't include them.
 *
 * @param propList This can straight from the DB result, or an object already
 *                 ran through the `parsePropList` function.
 * @param perms    The permissions available for this user/object
 * @param propKeys An object that defines the keys of the result object.
 *                 The values are currently unused.
 */
export const parseSecuredProperties = <
  DbProps extends Record<string, any>,
  PickedKeys extends keyof DbProps
>(
  propList: PropListDbResult<DbProps> | DbProps,
  perms: PermissionsOf<DbProps>,
  propKeys: Record<PickedKeys, boolean>
) => {
  const props = Array.isArray(propList) ? parsePropList(propList) : propList;

  const merged = mapValues(propKeys, (_, key: PickedKeys) => {
    const res = {
      value: undefined,
      ...permissionDefaults,
      ...(perms[key] ?? {}),
    };
    return res.canRead ? { ...res, value: props[key] } : res;
  });
  return (merged as unknown) as { [K in PickedKeys]: Secured<DbProps[K]> };
};
