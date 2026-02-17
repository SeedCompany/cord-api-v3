import type { Redis } from 'ioredis';
import { Lock } from './lock';

export class Locker {
  constructor(
    private readonly redis: Redis,
    private readonly options: Locker.Options,
  ) {}

  /**
   * @example Simple
   * async function doSomething() {
   *   await using lock = this.locker.getLock('lockingResource');
   *   await lock.acquire();
   *  // or acquire immediately
   *   await using lock = await this.locker.getLock('lockingResource').acquire();
   *
   *   // critical code
   * }
   *
   * @example Lost lock handling
   * async function doSomething() {
   *   await using lock = this.locker.getLock('lockingResource', {
   *     onLockLost(err) {
   *       this.logger.error(err);
   *     },
   *   });
   *   await lock.acquire();
   *
   *   // with each iteration, check if the lock is still acquired
   *   // and break when it is lost.
   *   while (lock.isAcquired) {
   *     // critical cycle iteration
   *   }
   * }
   *
   * @example Optional lock
   * async function doSomething() {
   *   await using lock = this.locker.getLock('lockingResource', {
   *     acquireAttemptsLimit: 1,
   *   });
   *   const lockAcquired = await lock.tryAcquire();
   *   if (!lockAcquired) {
   *     return
   *   }
   *
   *   ...
   * }
   *
   * @example Temporary refresh
   * async function doSomething() {
   *   await using lock = this.locker.getLock('lockingResource', {
   *     lockTimeout: '2 mins',
   *     refreshInterval: '15s',
   *     // Let the lock expire over time (2 mins) after operation is finished
   *     releaseOnDispose: false,
   *   });
   *
   *   // acquire
   *   ...
   * }
   *
   * @example Dynamically adjusting existing lock
   * // This creates an original lock
   * await using preMutex = this.locker.getLock('lockingResource', {
   *   lockTimeout: '10s',
   *   refreshInterval: 0, // disable refreshing
   *   releaseOnDispose: false,
   * });
   *
   * // This adapts the lock with a new TTL and starts refresh
   * await using lock = this.locker.getLock(preMutex.key, {
   *   identifier: preMutex.identifier,
   *   acquiredExternally: true, // required in this case
   *   lockTimeout: '30min',
   *   refreshInterval: '1min',
   * });
   *
   * @example shared lock between scheduler and handler apps
   * // scheduler app code
   * async function every10MinutesCronScheduler() {
   *   await using lock = this.locker.getLock('lockingResource', {
   *     lockTimeout: '30 mins',
   *     refreshInterval: 0, // disable refreshing
   *     releaseOnDispose: false,
   *   });
   *   if (await lock.tryAcquire()) {
   *     someQueue.publish({ lockIdentifier: lock.identifier })
   *   } else {
   *     logger.info('Job already scheduled. Do nothing in current cron cycle')
   *   }
   * }
   *
   * // handler app code
   * async function queueHandler(queueMessageData) {
   *   const { lockIdentifier } = queueMessageData
   *   await using lock = this.locker.getLock('lockingResource', {
   *     lockTimeout: '10 secs',
   *     identifier: lockIdentifier,
   *     acquiredExternally: true, // required in this case
   *   })
   *
   *   // Since acquired externally, this will do a `refresh` with the new
   *   // lockTimeout instead of `acquire`.
   *   // If the lock was locked by another process or the lock was expired,
   *   // an exception will be thrown (default refresh behavior)
   *   await lock.acquire();
   *
   *   ...
   * }
   */
  getLock(key: string, options?: Lock.Options) {
    return new Lock(this.redis, key, this.options, options);
  }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Locker {
  export interface Options {
    prefix?: string;
  }
}
