import { createMetadataDecorator } from '@seedcompany/nest';
import { type EnhancedResource, type Many, type ResourceShape } from '~/common';
import { type ResourceGranter } from './resource-granter';

/**
 * Declare custom granter for resource(s).
 * @example Extending from ResourceGranter
 * \@GranterFactory(Foo)
 * export class FooGranter extends ResourceGranter {
 *   get customGrant() { ... }
 *
 *   // don't touch the constructor
 * }
 *
 * @example Using a function instead to create the granter instance
 * \@GranterFactory(Foo, (res) => {
 *   // customize somehow returning...
 *   return new ResourceGranter(res);
 * })
 * export class FooGranterFactory {}
 *
 * @example Be sure to declare for TypeScript
 * declare module './path/to/components/authorization/policy/granters' {
 *   interface GrantersOverride {
 *     Foo: FooGranter;
 *   }
 * }
 */
export const Granter = createMetadataDecorator({
  setter: (
    resources: Many<ResourceShape<any>>,
    factory?: <TResourceStatic extends ResourceShape<any>>(
      resource: EnhancedResource<TResourceStatic>,
    ) => ResourceGranter<TResourceStatic>,
  ) => ({ resources, factory }),
  types: ['class'],
});
