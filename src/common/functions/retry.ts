import { type DurationIn } from '@seedcompany/common/temporal/luxon';
import { Duration } from 'luxon';
import pRetry, { AbortError, type Options as BaseOptions } from 'p-retry';
import { type Merge } from 'type-fest';

type AsyncFn = (...args: any[]) => Promise<any>;

type RetryOptions = Merge<
  BaseOptions,
  {
    /**
     * The maximum time (in milliseconds) that the retried operation is allowed to run.
     * @default Infinity
     */
    maxRetryTime?: DurationIn;
    /**
     * The duration before starting the first retry.
     * @default 1 second
     */
    minTimeout?: DurationIn;
    /**
     * The maximum duration between two retries.
     * @default Infinity
     */
    maxTimeout?: DurationIn;
  }
>;

const parseOptions = (options: RetryOptions = {}): BaseOptions => ({
  ...options,
  maxRetryTime: options.maxRetryTime
    ? Duration.from(options.maxRetryTime).toMillis()
    : undefined,
  minTimeout: options.minTimeout
    ? Duration.from(options.minTimeout).toMillis()
    : undefined,
  maxTimeout: options.maxTimeout
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

retry.AbortError = AbortError;
Retry.AbortError = AbortError;

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace retry {
  export type Options = RetryOptions;
}
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Retry {
  export type Options = RetryOptions;
}
