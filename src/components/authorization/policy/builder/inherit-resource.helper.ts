import { ValueOf } from 'type-fest';
import { ResourcesGranter } from '../granters';
import { withOther } from './resource-granter';

type Granter = ValueOf<ResourcesGranter>;

/**
 * This merges the permissions from the first granter, into the other ones.
 * This is useful with interfaces and implementations.
 * Without this, if an implementation is defined it completely overwrites the
 * permissions defined by the interface. Sometimes this is desired.
 * Other times you'd like to define interface permissions and add additional
 * permissions for a specific implementation. This allows you to do that in a DRY way.
 *
 * @example
 * \@Policy([], r => [
 *   inherit(
 *     r.Vehicle.read.specifically(p => p.color.edit),
 *     // truck will be readable and their color & tires can be edited.
 *     r.Truck.specifically(p => p.tires.edit),
 *   ),
 *
 *   // @example without inherit.
 *   r.Foo.read.create,
 *   // Assuming FooBar extends Foo, you'll still only be able to read it, not create.
 *   r.FooBar.read,
 * ])
 */
export function inherit(
  theInterface: Granter,
  ...implementations: Granter[]
): Granter[] {
  return [
    theInterface,
    ...implementations.map((granter) =>
      granter[withOther](theInterface as any),
    ),
  ];
}
