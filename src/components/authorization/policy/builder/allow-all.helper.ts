import { ValueOf } from 'type-fest';
import { ResourceAction } from '../actions';
import { ResourcesGranter } from '../granters';
import { asNormalized } from './as-normalized.helper';
import { action } from './perm-granter';

/**
 * A helper to allow these actions for all resources
 */
export const allowAll =
  (...actions: ResourceAction[]) =>
  (r: Partial<ResourcesGranter>) =>
    Object.values(r).map((res) => allowActions(res, ...actions));

/**
 * A helper to allow these actions for this resource.
 */
export const allowActions = (
  granter: ValueOf<ResourcesGranter>,
  ...actions: ResourceAction[]
) => asNormalized(granter, (g) => g[action](...actions));
