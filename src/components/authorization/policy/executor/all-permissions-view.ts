import { mapValues } from '@seedcompany/common';
import { type EnumType, makeEnum } from '@seedcompany/nest';
import { startCase } from 'lodash';
import { type PascalCase } from 'type-fest';
import {
  type ChildListsKey,
  type ChildSinglesKey,
  lazyRecord as createLazyRecord,
  type EnhancedResource,
  type ResourceShape,
  type SecuredPropsPlusExtraKey,
} from '~/common';
import {
  AnyAction,
  type ChildListAction,
  type ChildSingleAction,
  type PropAction,
} from '../actions';
import { type EdgePrivileges } from './edge-privileges';
import { type ResourcePrivileges } from './resource-privileges';

export type AllPermissionsView<TResourceStatic extends ResourceShape<any>> = Record<
  SecuredPropsPlusExtraKey<TResourceStatic>,
  Record<PropAction, boolean>
> &
  Record<ChildSinglesKey<TResourceStatic>, Record<ChildSingleAction, boolean>> &
  Record<ChildListsKey<TResourceStatic>, Record<ChildListAction, boolean>>;

export const createAllPermissionsView = <TResourceStatic extends ResourceShape<any>>(
  resource: EnhancedResource<TResourceStatic>,
  privileges: ResourcePrivileges<TResourceStatic>,
) =>
  createLazyRecord<AllPermissionsView<TResourceStatic>>({
    getKeys: () => [...resource.securedPropsPlusExtra, ...resource.childKeys],
    calculate: (propName) =>
      createLazyRecord<Record<CompatAction, boolean>>({
        getKeys: () => CompatAction.values,
        calculate: (actionInput, propPerms) => {
          const action =
            actionInput === 'canEdit' && resource.childListKeys.has(propName as any)
              ? 'create' // Handled deprecated checks to list.canEdit === list.create
              : compatMap.forward[actionInput];
          // @ts-expect-error dynamic usage here is struggling
          const perm = privileges.can(action, propName);
          propPerms[action] = perm;
          propPerms[compatMap.backward[action]] = perm;
          return perm;
        },
      }) as any,
  });

export type AllPermissionsOfEdgeView<TAction extends string> = Record<TAction, boolean>;

export const createAllPermissionsOfEdgeView = <
  TResourceStatic extends ResourceShape<any>,
  TKey extends string,
  TAction extends string,
>(
  resource: EnhancedResource<TResourceStatic>,
  privileges: EdgePrivileges<TResourceStatic, TKey, TAction>,
) =>
  createLazyRecord<Record<TAction, boolean>>({
    getKeys: () => [],
    calculate: (action) => privileges.can(action),
  });

const asLegacyAction = (action: AnyAction) =>
  `can${startCase(action)}` as `can${PascalCase<AnyAction>}`;

type CompatAction = EnumType<typeof CompatAction>;
const CompatAction = makeEnum([...AnyAction, ...[...AnyAction].map(asLegacyAction)]);

const compatMap = {
  forward: {
    ...mapValues.fromList(
      CompatAction,
      (action) => (action.startsWith('can') ? action.slice(3).toLowerCase() : action) as AnyAction,
    ).asRecord,
  },
  backward: {
    ...mapValues.fromList(AnyAction, asLegacyAction).asRecord,
  },
};
