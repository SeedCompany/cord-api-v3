import { mapValues } from '@seedcompany/common';
import { startCase } from 'lodash';
import { keys as keysOf } from 'ts-transformer-keys';
import { PascalCase } from 'type-fest';
import {
  ChildListsKey,
  ChildSinglesKey,
  EnhancedResource,
  ResourceShape,
  SecuredPropsPlusExtraKey,
} from '~/common';
import {
  AnyAction,
  ChildListAction,
  ChildSingleAction,
  PropAction,
} from '../actions';
import { createLazyRecord } from '../lazy-record';
import { UserEdgePrivileges } from './user-edge-privileges';
import { UserResourcePrivileges } from './user-resource-privileges';

export type AllPermissionsView<TResourceStatic extends ResourceShape<any>> =
  Record<
    SecuredPropsPlusExtraKey<TResourceStatic>,
    Record<PropAction, boolean>
  > &
    Record<
      ChildSinglesKey<TResourceStatic>,
      Record<ChildSingleAction, boolean>
    > &
    Record<ChildListsKey<TResourceStatic>, Record<ChildListAction, boolean>>;

export const createAllPermissionsView = <
  TResourceStatic extends ResourceShape<any>,
>(
  resource: EnhancedResource<TResourceStatic>,
  privileges: UserResourcePrivileges<TResourceStatic>,
) =>
  createLazyRecord<AllPermissionsView<TResourceStatic>>({
    getKeys: () => [...resource.securedPropsPlusExtra, ...resource.childKeys],
    calculate: (propName) =>
      createLazyRecord<Record<CompatAction, boolean>>({
        getKeys: () => keysOf<Record<CompatAction, boolean>>(),
        calculate: (actionInput, propPerms) => {
          const action =
            actionInput === 'canEdit' &&
            resource.childListKeys.has(propName as any)
              ? 'create' // Handled deprecated checks to list.canEdit === list.create
              : compatMap.forward[actionInput];
          // @ts-expect-error dynamic usage here is struggling
          const perm = privileges.can(action, propName);
          propPerms[action] = perm;
          propPerms[compatMap.backward[action]] = perm;
          return perm;
        },
      }),
  });

export type AllPermissionsOfEdgeView<TAction extends string> = Record<
  TAction,
  boolean
>;

export const createAllPermissionsOfEdgeView = <
  TResourceStatic extends ResourceShape<any>,
  TKey extends string,
  TAction extends string,
>(
  resource: EnhancedResource<TResourceStatic>,
  privileges: UserEdgePrivileges<TResourceStatic, TKey, TAction>,
) =>
  createLazyRecord<Record<TAction, boolean>>({
    getKeys: () => [],
    calculate: (action) => privileges.can(action),
  });

type CompatAction = AnyAction | `can${PascalCase<AnyAction>}`;

const compatMap = {
  forward: {
    ...mapValues.fromList(
      keysOf<Record<CompatAction, boolean>>(),
      (action) =>
        (action.startsWith('can')
          ? action.slice(3).toLowerCase()
          : action) as AnyAction,
    ).asRecord,
  },
  backward: {
    ...mapValues.fromList(
      keysOf<Record<AnyAction, boolean>>(),
      (action) => `can${startCase(action)}` as CompatAction,
    ).asRecord,
  },
};
