/**
 * Like Promise.all but with a limit on the number of promises executing at once.
 * Based on https://github.com/rxaviers/async-pool
 */
export const asyncPool = async <T, R>(
  concurrencyLimit: number,
  items: readonly T[],
  iteratee: (item: T, index: number) => Promise<R>,
): Promise<readonly R[]> => {
  const ret: Array<Promise<R>> = [];
  const executing: Array<Promise<void>> = [];
  for (let i = 0; i < items.length; i++) {
    const itemRunning = iteratee(items[i], i);
    ret.push(itemRunning);
    if (concurrencyLimit > items.length) {
      // skip pool logic and just promise.all on the entire array after iterating
      continue;
    }
    // after item running is done remove it from the executing array
    const e: Promise<void> = itemRunning.then(() => {
      executing.splice(executing.indexOf(e), 1);
    });
    executing.push(e);
    // if pool is full wait for the fastest item to finish before adding another
    if (executing.length >= concurrencyLimit) {
      await Promise.race(executing);
    }
  }
  // Resolve the remaining items in progress and collapse promises to values
  return await Promise.all(ret);
};
