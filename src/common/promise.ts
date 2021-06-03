import * as plimit from 'p-limit';

export const runPromises = async <T>(
  promises: Array<Promise<T>>,
  concurrency = 10
): Promise<void> => {
  const limit = plimit(concurrency);
  const input = promises.map((p) => limit(() => p));
  await Promise.all(input);
};
