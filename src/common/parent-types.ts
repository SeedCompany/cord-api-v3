import { cmpBy } from '@seedcompany/common';
import { AbstractClassType, IntersectTypes } from './types';

/**
 * Returns a list of all the parent class types including the given one.
 */
export function getParentTypes(
  type: AbstractClassType<unknown>,
  types: ReadonlyArray<AbstractClassType<unknown>> = [type],
): ReadonlyArray<AbstractClassType<unknown>> {
  // Special handling of classes coming from IntersectTypes()
  const members = Object.getOwnPropertyDescriptor(type, 'members')?.value as
    | ReturnType<typeof IntersectTypes>['members']
    | undefined;
  if (members && Array.isArray(members)) {
    const intersectedAncestors = members
      .flatMap((member) => [...getParentTypes(member).entries()])
      // Try to maintain order when merging ancestors
      .sort(cmpBy(([idx]) => idx))
      .map(([_, type]) => type);
    const uniqueAncestors = [...new Set(intersectedAncestors)];
    return [...types, ...uniqueAncestors];
  }

  const parent = Object.getPrototypeOf(type);
  if (parent == null) {
    // if no parent we are at native Object. We are done but drop the last two
    // as they are the implicit native object and its function constructor.
    // These are never explicitly declared in user-land code, and we don't care about them.
    return types.slice(0, -2);
  }

  return getParentTypes(parent, [...types, parent]);
}
