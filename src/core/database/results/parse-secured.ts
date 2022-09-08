import { keys, mapFromList } from '../../../common';
import type { Secured } from '../../../common';
import {
  permissionDefaults,
  PermissionsOf,
} from '../../../components/authorization/authorization.service';

/**
 * Parses secured properties from a DB result's propList & permList.
 *
 * The propKeys are passed in to determine the keys of the resulting object.
 * This allows default values to be given when the DB result doesn't include them.
 *
 * @param props    The unsecured props to secure.
 * @param perms    The permissions available for this user/object
 * @param propKeysObjectOrList A list of keys that define the result object or
 *                 an object that defines the keys of the result object.
 */
export const parseSecuredProperties = <
  DbProps extends Record<string, any>,
  PickedKeys extends keyof DbProps & string
>(
  props: DbProps,
  perms: PermissionsOf<DbProps>,
  propKeysObjectOrList: Record<PickedKeys, boolean> | readonly PickedKeys[]
) => {
  const mapKey = (key: PickedKeys) => {
    const res = {
      value: undefined,
      ...permissionDefaults,
      ...(perms[key] ?? {}),
    };
    return res.canRead ? { ...res, value: props[key] } : res;
  };

  const propKeys = Array.isArray(propKeysObjectOrList)
    ? propKeysObjectOrList
    : keys<PickedKeys & string>(
        propKeysObjectOrList as Record<PickedKeys, boolean>
      );

  const merged = mapFromList(propKeys, (key) => [key, mapKey(key)]);

  return merged as { [K in PickedKeys]: Secured<DbProps[K]> };
};
