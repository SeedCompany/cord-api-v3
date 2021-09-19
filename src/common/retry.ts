import { Duration, DurationLike } from 'luxon';
import * as pRetry from 'p-retry';
import { Merge } from 'type-fest';

export { AbortError } from 'p-retry';

export type RetryOptions = Merge<
  pRetry.Options,
  {
    /**
     * The maximum time (in milliseconds) that the retried operation is allowed to run.
     * @default Infinity
     */
    maxRetryTime?: DurationLike;
    /**
     * The duration before starting the first retry.
     * @default 1 second
     */
    minTimeout?: DurationLike;
    /**
     * The maximum duration between two retries.
     * @default Infinity
     */
    maxTimeout?: DurationLike;
  }
>;

export const retry = <T>(
  input: (attemptCount: number) => PromiseLike<T> | T,
  options?: RetryOptions
): Promise<T> =>
  pRetry(input, {
    ...options,
    maxRetryTime: options?.maxRetryTime
      ? Duration.from(options.maxRetryTime).toMillis()
      : undefined,
    minTimeout: options?.minTimeout
      ? Duration.from(options.minTimeout).toMillis()
      : undefined,
    maxTimeout: options?.maxTimeout
      ? Duration.from(options.maxTimeout).toMillis()
      : undefined,
  });
