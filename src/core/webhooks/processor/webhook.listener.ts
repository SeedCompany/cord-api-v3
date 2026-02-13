import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { asNonEmptyArray, cached, uniq } from '@seedcompany/common';
import { CompositeChannel, internal } from '~/core/broadcast';
import { BroadcastPublishedHook } from '~/core/broadcast/hooks';
import { OnHook } from '~/core/hooks';
import { WebhookTrigger } from '../dto';
import { WebhookProcessorQueue } from './webhook-processor.queue';

interface PendingBatch {
  readonly events: BroadcastPublishedHook[];
  readonly trigger: WebhookTrigger;
  readonly timer: NodeJS.Timeout;
}

/**
 * Listens for published broadcast events and pushes it to a queue for processing.
 *
 * Events fired over multiple channels rapidly are grouped together
 * if they share the same data identity,
 * so that they can be processed together and share a trigger.
 */
@Injectable()
export class WebhookListener implements OnModuleDestroy {
  /**
   * Pending batches keyed by event object identity.
   */
  private readonly pendingBatches = new Map<unknown, PendingBatch>();
  /**
   * How long to wait before processing batched events with the same data identity.
   * This allows the same data object published to multiple channels to share a trigger.
   */
  private static readonly batchWindowMs = 10;

  constructor(private readonly queue: WebhookProcessorQueue) {}

  draining = Promise.resolve();
  async onModuleDestroy() {
    // Flush all pending batches immediately on shutdown
    for (const [_, batch] of this.pendingBatches) {
      await this.enqueueBatch(batch);
    }
    await this.draining;
  }

  // FYI this hook is not awaited, so all of this happens in the background.
  @OnHook(BroadcastPublishedHook)
  onEventPublished(event: BroadcastPublishedHook) {
    if (internal.is(event.channel)) {
      return;
    }

    const batch = cached(this.pendingBatches, event.data, (): PendingBatch => {
      const newBatch: PendingBatch = {
        events: [],
        trigger: new WebhookTrigger(),
        timer: setTimeout(() => {
          this.draining = this.draining.then(() => this.enqueueBatch(newBatch));
        }, WebhookListener.batchWindowMs),
      };
      return newBatch;
    });
    batch.events.push(event);
  }

  private async enqueueBatch(pending: PendingBatch) {
    const { timer, trigger, ...batch } = pending;

    clearTimeout(timer);

    const events = asNonEmptyArray(batch.events);
    if (!events) {
      // shouldn't ever happen
      return;
    }
    const { data } = events[0];

    this.pendingBatches.delete(data);

    await this.queue.add('process', {
      trigger,
      channels: uniq(events.flatMap((e) => CompositeChannel.names(e.channel))),
      data,
    });
  }
}
