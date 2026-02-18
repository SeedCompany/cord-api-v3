import { OnWorkerEvent } from '@nestjs/bullmq';
import { asyncPool, mapValues } from '@seedcompany/common';
import { type BulkJobOptions } from 'bullmq';
import { type ExecutionResult } from 'graphql';
import { randomUUID } from 'node:crypto';
import { ILogger, Logger } from '~/core/logger';
import { Processor, WorkerHost } from '~/core/queue';
import { type JobOf } from '~/core/queue';
import { WebhookChannelService } from '../channels/webhook-channel.service';
import { WebhookDeliveryQueue } from '../delivery/webhook-delivery.queue';
import {
  WebhookError,
  WebhookEventEmissionError,
  WebhookExecutor,
} from '../executor/webhook.executor';
import { WebhookProcessorQueue } from './webhook-processor.queue';

type Job = JobOf<WebhookProcessorQueue>;

/**
 * Holds logic to find registered webhooks for the job's event channels,
 * execute subscription resolvers that each webhook describes,
 * and send to the delivery queue.
 */
@Processor(WebhookProcessorQueue.NAME, {
  // This queue is essentially executing a GQL query
  // for every webhook associated with the event.
  // This is a good amount of CPU work, though I'm sure there's a lot of DB waiting.
  // This worker also runs in the same process as the webserver, and we don't want
  // to degrade those requests. This processing can be slower since it is async.
  // Each node in our cluster also runs this worker,
  // so we can get some parallelism across the cluster.
  concurrency: 1,
  settings: {
    backoffStrategy: WebhookProcessorQueue.retryStrategy,
  },
})
export class WebhookProcessorWorker extends WorkerHost {
  constructor(
    private readonly channels: WebhookChannelService,
    private readonly executor: WebhookExecutor,
    private readonly delivery: WebhookDeliveryQueue,
    @Logger('webhooks') private readonly logger: ILogger,
  ) {
    super();
  }

  async process(job: Job) {
    const { channels, data, trigger } = job.data;

    const webhooks = await this.channels.listFor(channels);
    if (!webhooks.length) {
      return;
    }

    const eventMap = mapValues.fromList(channels, () => [data]).asMap;

    const payloadsByHook = asyncPool(3, webhooks, async ({ webhook }) => {
      let fatal = false;
      const payloads = await this.executor
        .executeWithEvents(webhook, eventMap)
        .catch(async (e: Error): Promise<ExecutionResult[]> => {
          if (!(e instanceof WebhookError)) {
            throw e;
          }
          if (e instanceof WebhookEventEmissionError) {
            // since this error happened from a specific event,
            // we'll keep the webhook valid, as other emissions may be fine.
          } else {
            // This is validation or an initialization failure,
            // so the webhook will never be valid.
            // Stop trying to execute it until the owner makes a change to it.
            await this.channels.markInvalid(webhook, e);
            fatal = true;
          }
          // emit an error payload to the webhook, so it is notified
          return [{ errors: e.errors }];
        });
      return { webhook, payloads, fatal };
    });

    for await (const { webhook, payloads, fatal } of payloadsByHook) {
      await this.delivery.addBulk(
        payloads.map((payload) => ({
          name: 'send-event',
          data: { webhook, payload, trigger, fatal },
          options: {
            // This will become the request ID sent with the payload,
            // so the consumer can use it for deduplication on retries.
            // Incrementing integers are not sufficient here since they could
            // be repeated when the queue history is cleared.
            jobId: randomUUID(),
          } satisfies BulkJobOptions,
        })),
      );
    }

    this.logger.debug('Processed webhook event', job.data);
  }

  @OnWorkerEvent('failed')
  onError(job: Job, error: Error) {
    this.logger.error('Failed to process webhook event', {
      ...job.data,
      exception: error,
    });
  }
}
