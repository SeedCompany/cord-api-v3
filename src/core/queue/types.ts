import {
  type Job,
  type QueueEventsListener as QueueEventsMap,
  type QueueGetters,
  type WorkerListener as WorkerEventMap,
} from 'bullmq';

/**
 * Same as Job, just reordered params that make more sense for declaration.
 */
export type NamedJob<
  NameType extends string,
  DataType,
  ReturnType = void,
> = Job<DataType, ReturnType, NameType>;

export type JobOf<Q> = Q extends QueueGetters<infer TJob> ? TJob : never;

export type WorkerEventArgs<K extends keyof WorkerEventMap> = Parameters<
  WorkerEventMap[K]
>;
export type QueueEventArgs<K extends keyof QueueEventsMap> = Parameters<
  QueueEventsMap[K]
>;
