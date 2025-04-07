import { DurationIn as DurationLike } from '@seedcompany/common/temporal/luxon';
import { Duration } from 'luxon';
import pRetry, { Options } from 'p-retry';
import { Merge } from 'type-fest';

type AsyncFn = (...args: any[]) => Promise<any>;

export { AbortError } from 'p-retry';

export type RetryOptions = Merge<
  Options,
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

const parseOptions = (options: RetryOptions = {}): Options => ({
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

export const retry = <T>(
  input: (attemptCount: number) => PromiseLike<T> | T,
  options?: RetryOptions,
): Promise<T> => pRetry(input, parseOptions(options));

export const Retry =
  (options?: RetryOptions) =>
  (
    target: unknown,
    key: string | symbol,
    descriptor: TypedPropertyDescriptor<AsyncFn>,
  ) => {
    const parsed = parseOptions(options);
    const orig = descriptor.value!;
    const next: Record<typeof key, AsyncFn> = {
      [key]: function (...args: any[]) {
        return pRetry(() => orig.apply(this, args), parsed);
      },
    };
    descriptor.value = next[key];
  };
