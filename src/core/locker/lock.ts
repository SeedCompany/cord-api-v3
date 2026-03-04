import { mapValues } from '@seedcompany/common';
import type { Redis } from 'ioredis';
import { Duration } from 'luxon';
import {
  type LockLostCallback,
  // eslint-disable-next-line @seedcompany/no-unused-vars
  type LostLockError,
  Mutex,
  type LockOptions as RawOptions,
} from 'redis-semaphore';
import type { DurationIn } from '~/common';
import type { Locker } from './locker.service';

export class Lock extends Mutex implements AsyncDisposable {
  private readonly releaseOnDispose: boolean;

  /** @internal */
  constructor(
    redis: Redis,
    readonly key: string,
    lockerOptions: Locker.Options,
    { releaseOnDispose, ...options }: Lock.Options = {},
  ) {
    super(
      redis,
      (lockerOptions.prefix ?? '') + key,
      options ? normalizeOptions(options) : undefined,
    );
    this.releaseOnDispose = releaseOnDispose ?? true;
  }

  // @ts-expect-error yeah changing the return type
  async acquire() {
    await super.acquire();
    return this;
  }

  async [Symbol.asyncDispose]() {
    if (this.releaseOnDispose) {
      await this.release();
    } else {
      this.stopRefresh();
    }
  }

  /** Helper so the caller doesn't have to mess with the symbol. */
  async dispose() {
    await this[Symbol.asyncDispose]();
  }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Lock {
  // Redefining these to allow smart durations & to document each property.

  export type Options = Pick<
    RawOptions,
    'identifier' | 'acquiredExternally'
  > & {
    /**
     * The duration until the lock will be auto-released (expired).
     *
     * @default 10 seconds
     */
    lockTimeout?: DurationIn;
    /**
     * The max timeout for {@link Lock.acquire} call
     *
     * @default 10 seconds
     */
    acquireTimeout?: DurationIn;
    /**
     * The max number of attempts to be made in {@link Lock.acquire} call
     *
     * @default Infinity
     */
    acquireAttemptsLimit?: number;
    /**
     * Time between acquiring attempts if resource locked
     *
     * @default 10 milliseconds
     */
    retryInterval?: DurationIn;
    /**
     * The auto-refresh interval; to disable behavior set to 0
     *
     * @default 80% of {@link lockTimeout}
     */
    refreshInterval?: DurationIn;
    /**
     * Called when lock loss is detected due refresh cycle.
     *
     * @default throws (unhandled) {@link LostLockError}
     */
    onLockLost?: LockLostCallback;
  } & {
    /**
     * Whether to release lock on {@link Lock.dispose} call.
     * If false, the lock will just release as the timeout expires.
     *
     * @default true
     */
    releaseOnDispose?: boolean;
  };
}

const normalizeOptions = (options: Lock.Options): RawOptions =>
  mapValues(options, (key, value) => {
    if (
      value != null &&
      (key.endsWith('Timeout') || key.endsWith('Interval'))
    ) {
      return Duration.from(value as DurationIn).toMillis();
    }
    return value;
  }).asRecord as RawOptions;
