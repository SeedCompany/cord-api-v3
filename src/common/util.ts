import { compact } from 'lodash';

export const simpleSwitch = <T, K extends string = string>(
  key: K | null | undefined,
  options: Record<K, T>,
): T | undefined => (key ? options[key] : undefined);

/** Converts list to map given a function that returns a [key, value] tuple. */
export const mapFromList = <T, S = T, K extends string | number = string>(
  list: readonly T[] | ReadonlySet<T>,
  mapper: (item: T) => readonly [K, S] | null,
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

/**
 * Work around `in` operator not narrowing type
 * https://github.com/microsoft/TypeScript/issues/21732
 */
export function has<K extends string | number | symbol, T>(
  key: K,
  obj: T,
): obj is T & Record<K, unknown> {
  return key in (obj as any);
}

export const csv = (str: string): readonly string[] =>
  compact(str.split(',').map((s) => s.trim()));

/**
 * This is logically very simple.
 * The usefulness is to allow this logic within an expression.
 */
export const firstOr = <T>(items: readonly T[], makeError: () => Error): T => {
  const first = items.at(0);
  if (first) {
    return first;
  }
  throw makeError();
};
