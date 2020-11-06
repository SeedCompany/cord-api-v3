import * as pRetry from 'p-retry';
import { Merge } from 'type-fest';
import { MsDurationInput, parseMilliseconds } from './util';

export { AbortError } from 'p-retry';

export type RetryOptions = Merge<
  pRetry.Options,
  {
    /**
     * The maximum time (in milliseconds) that the retried operation is allowed to run.
     * @default Infinity
     */
    maxRetryTime?: MsDurationInput;
    /**
     * The duration before starting the first retry.
     * @default 1 second
     */
    minTimeout?: MsDurationInput;
    /**
     * The maximum duration between two retries.
     * @default Infinity
     */
    maxTimeout?: MsDurationInput;
  }
>;

export const retry = <T>(
  input: (attemptCount: number) => PromiseLike<T> | T,
  options?: RetryOptions
): Promise<T> =>
  pRetry(input, {
    ...options,
    maxRetryTime: options?.maxRetryTime
      ? parseMilliseconds(options.maxRetryTime)
      : undefined,
    minTimeout: options?.minTimeout
      ? parseMilliseconds(options.minTimeout)
      : undefined,
    maxTimeout: options?.maxTimeout
      ? parseMilliseconds(options.maxTimeout)
      : undefined,
  });
