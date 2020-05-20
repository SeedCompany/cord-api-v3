export type Many<T> = T | readonly T[];
export const many = <T>(item: Many<T>): readonly T[] =>
  Array.isArray(item) ? item : [item];

export const maybeMany = <T>(
  item: Many<T> | null | undefined
): readonly T[] | undefined => (item != null ? many(item) : undefined);

export const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export const mapSequential = async <T extends any, R>(
  items: T[],
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  const resolved: R[] = [];
  let i = 0;
  for (const item of items) {
    resolved.push(await mapper(item, i));
    ++i;
  }
  return resolved;
};
