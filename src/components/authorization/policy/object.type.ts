import { ResourceShape } from '~/common';

/**
 * An instance of a resource for use in executing policy conditions.
 * It's a bit unclear what this needs to be, so this could change in the future.
 * I at least know it needs to be unsecured, since that would happen after this process.
 *
 * This type mostly exists to be a DRY to reference this uncertainty since it's
 * pass around a lot of places in this module.
 */
export type ResourceObjectContext<TResourceStatic extends ResourceShape<any>> =
  TResourceStatic['prototype'];
