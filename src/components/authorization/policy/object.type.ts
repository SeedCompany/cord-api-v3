import { MaybeUnsecuredInstance, ResourceShape } from '~/common';

/**
 * An instance of a resource for use in executing policy conditions.
 * It's a bit unclear what this needs to be, so this could change in the future.
 * I at least know it needs to be unsecured, since that would happen after this process.
 *
 * This type mostly exists to be a DRY way to reference this uncertainty since it's
 * passed around a lot of places in this module.
 */
export type ResourceObjectContext<TResourceStatic extends ResourceShape<any>> =
  MaybeUnsecuredInstance<TResourceStatic>;
