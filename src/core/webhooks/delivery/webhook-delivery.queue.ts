import { Duration } from 'luxon';
import { leveledExpBackoff } from '~/common';
import { type Job, Queue, registerQueues } from '~/core/queue';
import { type WebhookExecution } from './webhook.sender';

export class WebhookDeliveryQueue extends Queue<Job<WebhookExecution>> {
  static NAME = WebhookDeliveryQueue.nameFor(WebhookDeliveryQueue);
  static register = () =>
    registerQueues({
      name: WebhookDeliveryQueue,
      defaultJobOptions: {
        // Let's be pretty gracious with retries here; to be kind to the consumer.
        // About 3 days based on the retry strategy below.
        attempts: 10,
        backoff: { type: 'custom' },
        removeOnComplete: {
          // These payloads can be big, so we should remove them as soon as possible.
          age: Duration.from({ hour: 0.5 }).as('seconds'),
          // Limit the number of completed jobs in Redis to prevent it
          // from filling up with delivered payloads from rapid user changes.
          count: 25,
        },
        removeOnFail: {
          // These payloads can be big, so we don't want to keep them too long.
          // Also, we've given the consumer 3 days to accept these events by this point.
          age: Duration.from({ hour: 1 }).as('seconds'),
          // Limit the number of failed jobs in Redis to prevent it
          // from filling up with undelivered payloads.
          count: 25,
        },
      },
    });
  static retryStrategy = leveledExpBackoff([
    { attempts: 1, initial: 0 },
    { attempts: 1, initial: '5 mins', jitter: 0.4 },
    { initial: '1 hour', max: '1 day', jitter: 0.4 },
  ]);
}
