import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import {
  asyncPool,
  cached,
  groupToMapBy,
  mapValues,
} from '@seedcompany/common';
import { type ExecutionResult } from 'graphql';
import { internal } from '../broadcast';
import { BroadcastPublishedHook } from '../broadcast/hooks';
import { OnHook } from '../hooks';
import { ILogger, Logger } from '../logger';
import { WebhookChannelService } from './channels/webhook-channel.service';
import { WebhookTrigger } from './dto';
import {
  WebhookError,
  WebhookEventEmissionError,
  WebhookExecutor,
} from './executor/webhook.executor';
import { WebhookSender } from './webhook.sender';

interface Batch {
  events: BroadcastPublishedHook[];
  trigger: WebhookTrigger;
  timer: NodeJS.Timeout;
}

/**
 * Holds logic to listen for published broadcast events,
 * find registered webhooks for those event channels,
 * execute subscription resolvers that each webhook describes,
 * and create HTTP POST requests for the appropriate webhooks.
 */
@Injectable()
export class WebhookListener implements OnModuleDestroy {
  /**
   * Pending batches keyed by event object identity.
   */
  private readonly pendingBatches = new Map<unknown, Batch>();
  /**
   * How long to wait before processing batched events with the same data identity.
   * This allows the same data object published to multiple channels to share a trigger.
   */
  private static readonly batchWindowMs = 10;

  constructor(
    private readonly channels: WebhookChannelService,
    private readonly executor: WebhookExecutor,
    private readonly sender: WebhookSender,
    @Logger('webhooks') private readonly logger: ILogger,
  ) {}

  draining = Promise.resolve();
  async onModuleDestroy() {
    // Flush all pending batches immediately on shutdown
    for (const [data, batch] of this.pendingBatches) {
      clearTimeout(batch.timer);
      this.pendingBatches.delete(data);
      this.enqueueBatch(batch);
    }
    await this.draining;
  }

  // FYI this hook is not awaited, so all of this happens in the background.
  @OnHook(BroadcastPublishedHook)
  onEventPublished(event: BroadcastPublishedHook) {
    if (internal.is(event.channel)) {
      return;
    }

    const batch = cached(this.pendingBatches, event.data, (id): Batch => {
      const newBatch: Batch = {
        events: [],
        trigger: new WebhookTrigger(),
        timer: setTimeout(() => {
          this.pendingBatches.delete(id);
          this.enqueueBatch(newBatch);
        }, WebhookListener.batchWindowMs),
      };
      return newBatch;
    });
    batch.events.push(event);
  }

  private enqueueBatch(batch: Batch) {
    // A simple promise chain as a placeholder for a real job queue.
    this.draining = this.draining.then(() =>
      this.handleJob(batch).then(
        () => {
          this.logger.debug('Processed webhook events', {
            channels: batch.events.map((e) => e.channel.name),
            data: batch.events.map((e) => e.data),
          });
        },
        (error) => {
          this.logger.error('Failed to process webhook events', {
            channels: batch.events.map((e) => e.channel.name),
            data: batch.events.map((e) => e.data),
            exception: error,
          });
        },
      ),
    );
  }

  private async handleJob({ events, trigger }: Batch) {
    // Build a map of channel name -> data for each event
    // All events share the same data object but may have different channels
    const channelMap = groupToMapBy(events, (e) => e.channel.name);

    const webhooks = await this.channels.listFor(channelMap.keys());
    if (!webhooks.length) {
      return;
    }

    const eventMap = mapValues(channelMap, (channel, publishes) =>
      publishes.map((e) => e.data),
    ).asMap;

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
      for (const payload of payloads) {
        await this.sender.push({ webhook, payload, trigger, fatal });
      }
    }
  }
}
