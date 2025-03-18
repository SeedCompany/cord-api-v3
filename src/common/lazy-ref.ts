/**
 * Returns "an object" that calls the given function every time
 * it is referenced to get the actual object.
 */
export const lazyRef = <T extends object>(getter: () => T): T => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return new Proxy({} as T, {
    get(target: T, p: string | symbol, receiver: unknown) {
      if (p === unlazyKey) {
        return getter();
      }
      return Reflect.get(getter(), p, receiver);
    },
    has(target: T, p: string | symbol): boolean {
      if (p === unlazyKey) {
        return true;
      }
      return Reflect.has(getter(), p);
    },
    ownKeys() {
      return Reflect.ownKeys(getter());
    },
    getPrototypeOf() {
      return Reflect.getPrototypeOf(getter());
    },
  });
};

lazyRef.unlazy = (object: unknown) => {
  if (object && typeof object === 'object' && unlazyKey in object) {
    return (object as any)[unlazyKey];
  }
  return object;
};

const unlazyKey = Symbol('unlazy');
