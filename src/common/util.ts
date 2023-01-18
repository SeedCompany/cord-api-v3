import { Duration, DurationLike } from 'luxon';

export type Many<T> = T | readonly T[];
export const many = <T>(item: Many<T>): readonly T[] =>
  Array.isArray(item) ? item : [item as T];

export const maybeMany = <T>(
  item: Many<T> | null | undefined
): readonly T[] | undefined => (item != null ? many(item) : undefined);

export const sleep = (duration: string | DurationLike) =>
  new Promise((resolve) =>
    setTimeout(resolve, Duration.from(duration).toMillis())
  );

export const simpleSwitch = <T, K extends string = string>(
  key: K | null | undefined,
  options: Record<K, T>
): T | undefined => (key ? options[key] : undefined);

/** Converts list to map given a function that returns a [key, value] tuple. */
export const mapFromList = <T, S = T, K extends string | number = string>(
  list: readonly T[] | ReadonlySet<T>,
  mapper: (item: T) => readonly [K, S] | null
): Record<K, S> => {
  const out: Partial<Record<K, S>> = {};
  list = list instanceof Set ? [...list] : (list as T[]);
  return list.reduce((acc, item) => {
    const res = mapper(item);
    if (!res) {
      return acc;
    }
    const [key, value] = res;
    acc[key] = value;
    return acc;
  }, out as Record<K, S>);
};

/**
 * Just like Object.entries except keys are strict
 */
export const entries: <K extends string, V>(o: Record<K, V>) => Array<[K, V]> =
  Object.entries as any;

/**
 * Just like Object.keys except keys are strict
 */
export const keys: <K extends string>(o: Record<K, unknown>) => K[] =
  Object.keys as any;

export const iterate = <T>(
  iterator: Iterable<T> | IterableIterator<T>
): readonly T[] => {
  const res: T[] = [];
  for (const item of iterator) {
    res.push(item);
  }
  return res;
};

/**
 * Work around `in` operator not narrowing type
 * https://github.com/microsoft/TypeScript/issues/21732
 */
export function has<K extends string | number | symbol, T>(
  key: K,
  obj: T
): obj is T & Record<K, unknown> {
  return key in (obj as any);
}

/**
 * A Set that will render as a list in JSON.stringify
 */
export class JsonSet extends Set {
  toJSON() {
    return [...this];
  }
}
