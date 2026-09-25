/**
 * @example Add to this type
 *
 * \@RegisterResource()
 * class Foo {}
 *
 * declare module '~/core/resources/map' {
 *   interface ResourceMap {
 *     Foo: typeof Foo;
 *   }
 * }
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ResourceMap {
  // Use interface merging to add to this interface in the owning module.
}
