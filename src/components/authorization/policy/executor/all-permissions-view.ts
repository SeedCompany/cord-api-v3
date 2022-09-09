import { startCase } from 'lodash';
import { keys as keysOf } from 'ts-transformer-keys';
import { PascalCase } from 'type-fest';
import { mapFromList, ResourceShape, SecuredResourceKey } from '~/common';
import { Action } from '../builder/perm-granter';
import { ScopedPrivileges } from './scoped-privileges';

export type AllPermissionsView<TResourceStatic extends ResourceShape<any>> =
  Record<SecuredResourceKey<TResourceStatic>, Record<CompatAction, boolean>>;

export const createAllPermissionsView = <
  TResourceStatic extends ResourceShape<any>
>(
  resource: TResourceStatic,
  privileges: ScopedPrivileges<TResourceStatic>
) =>
  createLazyRecord<AllPermissionsView<TResourceStatic>>({
    getKeys: () => {
      const keys = new Set([
        ...resource.SecuredProps,
        ...Object.keys(resource.Relations ?? {}),
      ]);
      return [...keys] as Array<SecuredResourceKey<TResourceStatic>>;
    },
    calculate: (propName) =>
      createLazyRecord<Record<CompatAction, boolean>>({
        getKeys: () => keysOf<Record<CompatAction, boolean>>(),
        calculate: (actionInput, propPerms) => {
          const action = compatMap.forward[actionInput];
          const perm = privileges.can(action, propName);
          propPerms[action] = perm;
          propPerms[compatMap.backward[action]] = perm;
          return perm;
        },
      }),
  });

type CompatAction = Action | `can${PascalCase<Action>}`;

const compatMap = {
  forward: {
    ...mapFromList(keysOf<Record<CompatAction, boolean>>(), (action) => [
      action,
      (action.startsWith('can')
        ? action.slice(3).toLowerCase()
        : action) as Action,
    ]),
  },
  backward: {
    ...mapFromList(keysOf<Record<Action, boolean>>(), (action) => [
      action,
      `can${startCase(action)}` as CompatAction,
    ]),
  },
};

/**
 * Returns object matching any shape and calls the given functions to calculate
 * property values as needed.
 */
const createLazyRecord = <T extends object>({
  calculate,
  getKeys,
}: {
  getKeys: () => Array<keyof T & string>;
  calculate: (key: keyof T & string, object: Partial<T>) => T[keyof T & string];
}) => {
  const proxy = new Proxy<Partial<T>>(
    {},
    {
      // All props are enumerable
      getOwnPropertyDescriptor: () => ({
        enumerable: true,
        configurable: true,
      }),
      ownKeys: getKeys,
      get: (target, propName: keyof T & string) => {
        if (target[propName]) {
          return target[propName];
        }
        const value = calculate(propName, target);
        target[propName] = value;
        return value;
      },
    }
  );
  return proxy as T;
};
