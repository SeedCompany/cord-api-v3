import { Duration, DurationInput } from 'luxon';
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
    maxRetryTime?: DurationInput;
    /**
     * The duration before starting the first retry.
     * @default 1 second
     */
    minTimeout?: DurationInput;
    /**
     * The maximum duration between two retries.
     * @default Infinity
     */
    maxTimeout?: DurationInput;
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
