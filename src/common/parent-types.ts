import { AbstractClassType } from './types';

/**
 * Returns a list of all the parent class types including the given one.
 */
export function getParentTypes(
  type: AbstractClassType<unknown>,
  types: ReadonlyArray<AbstractClassType<unknown>> = [type],
): ReadonlyArray<AbstractClassType<unknown>> {
  const parent = Object.getPrototypeOf(type);
  if (parent == null) {
    // if no parent we are at native Object. We are done but drop the last two
    // as they are the implicit native object and its function constructor.
    // These are never explicitly declared in user-land code, and we don't care about them.
    return types.slice(0, -2);
  }
  return getParentTypes(parent, [...types, parent]);
}
