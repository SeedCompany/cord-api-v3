import { DiscoveryService } from '@golevelup/nestjs-discovery';
import { SetMetadata } from '@nestjs/common';
import { EnhancedResource, Many, ResourceShape } from '~/common';
import { ResourceGranter } from './resource-granter';

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
export const Granter = (
  resources: GranterMetadata['resources'],
  factory?: GranterMetadata['factory'],
): ClassDecorator =>
  SetMetadata<any, GranterMetadata>(GRANTER_FACTORY_METADATA_KEY, {
    resources,
    factory,
  });

export const discover = (discovery: DiscoveryService) =>
  discovery.providersWithMetaAtKey<GranterMetadata>(
    GRANTER_FACTORY_METADATA_KEY,
  );

const GRANTER_FACTORY_METADATA_KEY = Symbol('GranterFactory');

interface GranterMetadata {
  resources: Many<ResourceShape<any>>;
  factory?: <TResourceStatic extends ResourceShape<any>>(
    resource: EnhancedResource<TResourceStatic>,
  ) => ResourceGranter<TResourceStatic>;
}
