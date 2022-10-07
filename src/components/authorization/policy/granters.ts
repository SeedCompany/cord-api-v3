import { Merge } from 'type-fest';
import { ResourceMap } from '~/core/resources';
import { ResourceGranter } from './builder/resource-granter';

export type ResourcesGranter = Merge<
  {
    [K in keyof ResourceMap]: ResourceGranter<ResourceMap[K]>;
  },
  GrantersOverride
>;

/**
 * Only use to define custom granter with interface merging.
 * See {@link Granter} for more info on that.
 *
 * For usage, use {@link ResourcesGranter} instead.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface GrantersOverride {
  // Use interface merging to add to this interface in the owning module.
}
