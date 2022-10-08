import { ValueOf } from 'type-fest';
import { ResourcesGranter } from '../granters';
import { ResourceGranter } from './resource-granter';

/**
 * A helper to execute actions on a granter with the "normalized" / base class type.
 * I'd like to instead enforce that the granter overrides extend ResourceGranter,
 * but I'm having trouble. So instead we'll confirm at runtime and use this to ease
 * with typecasting.
 */
export const asNormalized = (
  granter: ValueOf<ResourcesGranter>,
  fn: (granter: ResourceGranter<any>) => ResourceGranter<any>
): ValueOf<ResourcesGranter> =>
  fn(granter as ResourceGranter<any>) as ValueOf<ResourcesGranter>;
