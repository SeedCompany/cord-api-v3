import { startCase } from 'lodash';
import { keys as keysOf } from 'ts-transformer-keys';
import { PascalCase } from 'type-fest';
import {
  ChildRelationsKey,
  EnhancedResource,
  mapFromList,
  ResourceShape,
  SecuredPropsAndSingularRelationsKey,
} from '~/common';
import { AnyAction, ChildRelationshipAction, PropAction } from '../actions';
import { createLazyRecord } from '../lazy-record';
import { ScopedPrivileges } from './scoped-privileges';

export type AllPermissionsView<TResourceStatic extends ResourceShape<any>> =
  Record<
    SecuredPropsAndSingularRelationsKey<TResourceStatic>,
    Record<PropAction, boolean>
  > &
    Record<
      ChildRelationsKey<TResourceStatic>,
      Record<ChildRelationshipAction, boolean>
    >;

export const createAllPermissionsView = <
  TResourceStatic extends ResourceShape<any>
>(
  resource: EnhancedResource<TResourceStatic>,
  privileges: ScopedPrivileges<TResourceStatic>
) =>
  createLazyRecord<AllPermissionsView<TResourceStatic>>({
    getKeys: () => {
      const keys = new Set([
        ...resource.securedProps,
        ...resource.relationKeys,
      ]);
      return [...keys] as Array<keyof AllPermissionsView<TResourceStatic>>;
    },
    calculate: (propName) =>
      createLazyRecord<Record<CompatAction, boolean>>({
        getKeys: () => keysOf<Record<CompatAction, boolean>>(),
        calculate: (actionInput, propPerms) => {
          const action = compatMap.forward[actionInput];
          const perm = privileges.can(action as PropAction, propName);
          propPerms[action] = perm;
          propPerms[compatMap.backward[action]] = perm;
          return perm;
        },
      }),
  });

type CompatAction = AnyAction | `can${PascalCase<AnyAction>}`;

const compatMap = {
  forward: {
    ...mapFromList(keysOf<Record<CompatAction, boolean>>(), (action) => [
      action,
      (action.startsWith('can')
        ? action.slice(3).toLowerCase()
        : action) as AnyAction,
    ]),
  },
  backward: {
    ...mapFromList(keysOf<Record<AnyAction, boolean>>(), (action) => [
      action,
      `can${startCase(action)}` as CompatAction,
    ]),
  },
};
