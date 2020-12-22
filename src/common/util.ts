import { isNumber } from 'lodash';
import { Duration, DurationObject } from 'luxon';

export type Many<T> = T | readonly T[];
export const many = <T>(item: Many<T>): readonly T[] =>
  Array.isArray(item) ? item : [item as T];

export const maybeMany = <T>(
  item: Many<T> | null | undefined
): readonly T[] | undefined => (item != null ? many(item) : undefined);

export type MsDurationInput = number | Duration | DurationObject;
export const parseMilliseconds = (durationOrMs: MsDurationInput) => {
  const duration =
    durationOrMs instanceof Duration
      ? durationOrMs
      : Duration.fromObject(
          isNumber(durationOrMs) ? { milliseconds: durationOrMs } : durationOrMs
        );
  return duration.as('milliseconds');
};

export const sleep = (durationOrMs: MsDurationInput) =>
  new Promise((resolve) =>
    setTimeout(resolve, parseMilliseconds(durationOrMs))
  );

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

export const iterate = <T>(
  iterator: Iterable<T> | IterableIterator<T>
): T[] => {
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
  return key in obj;
}
