export {
  // Workers
  Processor, // class decorator
  WorkerHost, // base class
  OnWorkerEvent, // method decorator

  // Events
  QueueEventsListener, // class decorator
  QueueEventsHost, // base class
  OnQueueEvent, // method decorator
} from '@nestjs/bullmq';
export {
  Job,
  FlowProducer,
  DelayedError,
  UnrecoverableError,
  RateLimitError,
} from 'bullmq';
export * from './registration';
export * from './queue.patch';
export * from './types';
