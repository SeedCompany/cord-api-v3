import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { asyncPool } from '@seedcompany/common';
import { internal } from '../broadcast';
import { BroadcastPublishedHook } from '../broadcast/hooks';
import { OnHook } from '../hooks';
import { ILogger, Logger } from '../logger';
import { WebhookChannelService } from './channels/webhook-channel.service';
import { WebhookExecutor } from './executor/webhook.executor';

type WebhookJob = BroadcastPublishedHook;

/**
 * Holds logic to listen for published broadcast events,
 * find registered webhooks for those event channels,
 * execute subscription resolvers that each webhook describes,
 * and create HTTP POST requests for the appropriate webhooks.
 */
@Injectable()
export class WebhookListener implements OnModuleDestroy {
  constructor(
    private readonly channels: WebhookChannelService,
    private readonly executor: WebhookExecutor,
    @Logger('webhooks') private readonly logger: ILogger,
  ) {}

  private draining = Promise.resolve();
  async onModuleDestroy() {
    await this.draining;
  }

  // FYI this hook is not awaited, so all of this happens in the background.
  @OnHook(BroadcastPublishedHook)
  onEventPublished(event: BroadcastPublishedHook) {
    if (internal.is(event.channel)) {
      return;
    }

    // A simple promise chain as a placeholder for a real job queue.
    this.draining = this.draining.then(() =>
      this.handleJob(event).catch((error) => {
        this.logger.error('Failed to process webhook event', {
          channel: event.channel.name,
          data: event.data,
          exception: error,
        });
      }),
    );
  }

  private async handleJob({ channel, data }: WebhookJob) {
    const webhooks = await this.channels.listFor(channel.name);
    if (!webhooks.length) {
      return;
    }

    // There is potential for multiple events to be batched together here,
    // which would save only in subscription initialization code.
    // Seemingly only minor performance value there, and would add complexity
    // here to achieve.
    const events = new Map([[channel.name, [data]]]);

    const payloadsByHook = asyncPool(Infinity, webhooks, async (webhook) => {
      const payloads = await this.executor.executeWithEvents(webhook, events);
      return { webhook, payloads };
    });

    for await (const { webhook, payloads } of payloadsByHook) {
      for (const payload of payloads) {
        // TODO send
        const _send = { webhook, payload };
      }
    }
  }
}
