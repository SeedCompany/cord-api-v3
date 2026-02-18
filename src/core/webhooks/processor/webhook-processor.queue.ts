import { Duration } from 'luxon';
import { leveledExpBackoff } from '~/common';
import { type Job, Queue, registerQueues } from '~/core/queue';
import { type WebhookTrigger } from '../dto';

export class WebhookProcessorQueue extends Queue<
  Job<{
    readonly trigger: WebhookTrigger;
    readonly channels: readonly string[];
    readonly data: unknown;
  }>
> {
  static NAME = WebhookProcessorQueue.nameFor(WebhookProcessorQueue);
  static register = () =>
    registerQueues({
      name: WebhookProcessorQueue,
      defaultJobOptions: {
        // We really should not fail to resolve the queries for each webhook.
        // Only retry a couple of times in the case of a transient failure.
        attempts: 3,
        backoff: { type: 'custom' },
        removeOnComplete: {
          // These payloads are small, so they can stay for a little bit.
          // But there's not much reason to keep them around for a long time.
          age: Duration.from({ day: 2 }).as('seconds'),
        },
        removeOnFail: {
          // These payloads are small, so they can stay a long time.
          // These failures are something that we probably need to address.
          // Probably a bug in our GQL resolvers/etc.
          age: Duration.from({ weeks: 3 }).as('seconds'),
        },
      },
    });
  static retryStrategy = leveledExpBackoff([
    { attempts: 1, initial: '5 mins', jitter: 0.4 },
    { initial: '6 hours', max: '1 day', jitter: 0.4 },
  ]);
}
