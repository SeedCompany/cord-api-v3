export const CalculatedSymbol = Symbol('Calculated');

/**
 * Mark the resource or resource's property as calculated.
 * This means the resource/property is managed by the API, instead of the user.
 */
export const Calculated =
  (): PropertyDecorator & ClassDecorator =>
  (target: any, key?: string | symbol) => {
    if (!key) {
      Reflect.defineMetadata(CalculatedSymbol, true, target);
      return target;
    }
    Reflect.defineMetadata(CalculatedSymbol, true, target, key);
  };
