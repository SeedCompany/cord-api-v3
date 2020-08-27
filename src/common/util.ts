export type Many<T> = T | readonly T[];
export const many = <T>(item: Many<T>): readonly T[] =>
  Array.isArray(item) ? item : [item];

export const maybeMany = <T>(
  item: Many<T> | null | undefined
): readonly T[] | undefined => (item != null ? many(item) : undefined);

export const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export const simpleSwitch = <T>(
  key: string,
  options: Record<string, T>
): T | undefined => options[key];

/** Converts list to map given a function that returns a [key, value] tuple. */
export const mapFromList = <T, S = T, K extends string = string>(
  list: T[],
  mapper: (item: T) => [K, S]
): Record<K, S> => {
  const out: Partial<Record<K, S>> = {};
  return list.reduce((acc, item) => {
    const [key, value] = mapper(item);
    acc[key] = value;
    return acc;
  }, out as Record<K, S>);
};

/**
 * Just like Object.entries except keys are strict
 */
export const entries: <K extends string, V>(
  o: Record<K, V>
) => Array<[K, V]> = Object.entries as any;

/**
 * Just like Object.keys except keys are strict
 */
export const keys: <K extends string>(
  o: Record<K, unknown>
) => K[] = Object.keys as any;
