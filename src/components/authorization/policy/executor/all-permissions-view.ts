import { keys as keysOf } from 'ts-transformer-keys';
import { ResourceShape } from '~/common';
import { Action } from '../builder/perm-granter';
import { ResourceProps } from '../builder/prop-granter';
import { ResourcePrivileges } from './resource-privileges';

export type AllPermissionsView<TResourceStatic extends ResourceShape<any>> =
  Record<ResourceProps<TResourceStatic>, Record<Action, boolean>>;

export const createAllPermissionsView = <
  TResourceStatic extends ResourceShape<any>
>(
  resource: TResourceStatic,
  privileges: ResourcePrivileges<TResourceStatic>
) =>
  createLazyRecord<AllPermissionsView<TResourceStatic>>({
    getKeys: () => {
      const keys = new Set([
        ...resource.Props,
        ...Object.keys(resource.Relations ?? {}),
      ]);
      return [...keys] as Array<ResourceProps<TResourceStatic>>;
    },
    calculate: (propName) =>
      createLazyRecord<Record<Action, boolean>>({
        getKeys: () => keysOf<Record<Action, boolean>>(),
        calculate: (action) => privileges.can(action, propName),
      }),
  });

/**
 * Returns object matching any shape and calls the given functions to calculate
 * property values as needed.
 */
const createLazyRecord = <T extends object>({
  calculate,
  getKeys,
}: {
  getKeys: () => Array<keyof T & string>;
  calculate: (key: keyof T & string) => T[keyof T & string];
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
        const value = calculate(propName);
        target[propName] = value;
        return value;
      },
    }
  );
  return proxy as T;
};
