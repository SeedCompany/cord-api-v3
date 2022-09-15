import { startCase } from 'lodash';
import { keys as keysOf } from 'ts-transformer-keys';
import { PascalCase } from 'type-fest';
import {
  ChildListsKey,
  ChildSinglesKey,
  EnhancedResource,
  mapFromList,
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
import { ScopedPrivileges } from './scoped-privileges';

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
  TResourceStatic extends ResourceShape<any>
>(
  resource: EnhancedResource<TResourceStatic>,
  privileges: ScopedPrivileges<TResourceStatic>
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
