const get = (type: any) => Reflect.getMetadata(key, type) ?? {};

const set =
  (value: any): PropertyDecorator =>
  ({ constructor: type }, propertyKey) =>
    Reflect.defineMetadata(key, { ...get(type), [propertyKey]: value }, type);

/**
 * A helper to get/set default values for classes.
 * Usage of this is discouraged in favor or more common practices.
 * This is mostly useful with abstractions.
 * Note that the defaults aren't automatically applied, this just holds
 * a container for them - They need to be fetched explicitly.
 */
export const DefaultValue = { Get: get, Set: set };

const key = 'DefaultValue';
