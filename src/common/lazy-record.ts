/**
 * Returns an object matching any shape and calls the given functions
 * to calculate property values as needed.
 */
export const lazyRecord = <T extends object>({
  calculate,
  getKeys,
  base,
}: {
  getKeys: () => Array<keyof T & string> | ReadonlySet<keyof T & string>;
  calculate: (key: keyof T & string, object: Partial<T>) => T[keyof T & string];
  base?: Partial<T>;
}) => {
  const initial = base ?? {};
  const proxy = new Proxy<Partial<T>>(initial, {
    // All props are enumerable
    getOwnPropertyDescriptor: () => ({
      enumerable: true,
      configurable: true,
    }),
    ownKeys: () => {
      const res = getKeys();
      const keys = res instanceof Set ? res : new Set(res);
      return [...keys];
    },
    get: (target, propName: keyof T & string) => {
      if (target[propName]) {
        return target[propName];
      }
      const value = calculate(propName, target);
      target[propName] = value;
      return value;
    },
  });
  return proxy as T;
};
