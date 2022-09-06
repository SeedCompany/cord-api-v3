import { isPromise } from 'util/types';

/**
 * A helper to execute some logic once and store the result for the lifespan of the object.
 * The calculate function can be async or sync.
 */
export const cachedOnObject = <T extends object, R>(
  map: WeakMap<T, Awaited<R>>,
  object: T,
  calculate: () => R
): R => {
  if (map.has(object)) {
    return map.get(object)!;
  }

  const store = (result: Awaited<R>) => {
    map.set(object, result);
    return result;
  };

  const result = calculate();

  return isPromise(result)
    ? ((result as Promise<Awaited<R>>).then(store) as R)
    : store(result as Awaited<R>);
};

/**
 * A method decorator that will cache return values based on the input argument.
 * It's expected that this method takes a single argument that's a medium-lived object.
 *
 * The result does not need to be serializable.
 */
export const CachedOnArg =
  () =>
  <Arg extends object, R>(
    staticClass: any,
    methodName: string | symbol,
    descriptor: TypedPropertyDescriptor<(...args: [Arg]) => R>
  ) => {
    const execute = descriptor.value!;
    const staticMap = new WeakMap(); // holds WeakMap for each instance
    descriptor.value = function (arg) {
      const instanceMap = cachedOnObject(staticMap, this, () => new WeakMap());
      return cachedOnObject(instanceMap, arg, () => execute.call(this, arg));
    };
  };
