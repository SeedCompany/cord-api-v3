import {
  BullModule,
  getQueueToken,
  type RegisterQueueOptions,
} from '@nestjs/bullmq';
import type { Type } from '@nestjs/common';
import { isPlainObject } from '@nestjs/common/utils/shared.utils.js';
import { Queue } from './queue.patch';

type QueueCls = Type<Queue<any>>;

/**
 * A helper to register the queue in a module with our class extension concept.
 *
 * ```ts
 * imports: [
 *   registerQueues(
 *     XQueue,
 *     {
 *       name: YQueue,
 *       defaultJobOptions: { attempts: 3 }
 *     }
 *   ),
 * ]
 * ```
 *
 * TODO move options to queue class somehow?
 * TODO support for async?
 */
export const registerQueues = (
  ...queues: Array<
    QueueCls | (Omit<RegisterQueueOptions, 'name'> & { name: QueueCls })
  >
) => {
  const normalized = queues.map((queue) =>
    isPlainObject(queue)
      ? (queue as Exclude<typeof queue, QueueCls>)
      : { name: queue },
  );
  const dynamicModule = BullModule.registerQueue(
    ...normalized.map(({ name: type, ...options }) => ({
      name: Queue.nameFor(type),
      ...options,
    })),
  );
  return {
    ...dynamicModule,
    providers: [
      ...dynamicModule.providers!,
      ...normalized.map(({ name: type }) => ({
        provide: type,
        useExisting: getQueueToken(Queue.nameFor(type)),
      })),
    ],
    exports: [
      ...dynamicModule.exports!,
      ...normalized.map(({ name: type }) => type),
    ],
  };
};
