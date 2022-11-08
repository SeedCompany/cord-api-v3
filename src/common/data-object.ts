import { AbstractClassType } from './types';

/**
 * A helper class to try to enforce proper usage of data objects.
 * Data classes should only enforce a shape, no instances, and therefore no
 * methods or getter/setters.
 * This allows objects to be spread to change data while continuing to enforce
 * immutability.
 */
export abstract class DataObject {
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor,@typescript-eslint/no-empty-function,@seedcompany/no-unused-vars
  constructor(youShouldNotBeInstantiatingDataObjects: typeof inaccessible) {}

  static defaultValue<T extends DataObject>(
    type: AbstractClassType<T>,
    partialExtra?: Partial<T>
  ): T {
    // @ts-expect-error ignore abstract modifier it's only to prevent instantiation.
    // This is the only time we want to allow it.
    return Object.assign(new type(inaccessible), partialExtra);
  }
}

// Something that cannot be referenced, but still conforms to any (never does not).
const inaccessible = Symbol('inaccessible');
