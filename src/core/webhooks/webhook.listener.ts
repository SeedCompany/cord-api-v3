import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { asyncPool } from '@seedcompany/common';
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

type WebhookJob = BroadcastPublishedHook & {
  trigger: WebhookTrigger;
};

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
    private readonly sender: WebhookSender,
    @Logger('webhooks') private readonly logger: ILogger,
  ) {}

  draining = Promise.resolve();
  async onModuleDestroy() {
    await this.draining;
  }

  // FYI this hook is not awaited, so all of this happens in the background.
  @OnHook(BroadcastPublishedHook)
  onEventPublished(event: BroadcastPublishedHook) {
    if (internal.is(event.channel)) {
      return;
    }

    const trigger = new WebhookTrigger();

    // A simple promise chain as a placeholder for a real job queue.
    this.draining = this.draining.then(() =>
      this.handleJob({ ...event, trigger }).catch((error) => {
        this.logger.error('Failed to process webhook event', {
          channel: event.channel.name,
          data: event.data,
          exception: error,
        });
      }),
    );
  }

  private async handleJob({ channel, data, trigger }: WebhookJob) {
    const webhooks = await this.channels.listFor(channel.name);
    if (!webhooks.length) {
      return;
    }

    // There is potential for multiple events to be batched together here,
    // which would save only in subscription initialization code.
    // Seemingly only minor performance value there, and would add complexity
    // here to achieve.
    const events = new Map([[channel.name, [data]]]);

    const payloadsByHook = asyncPool(3, webhooks, async (webhook) => {
      const payloads = await this.executor
        .executeWithEvents(webhook, events)
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
          }
          // emit an error payload to the webhook, so it is notified
          return [{ errors: e.errors }];
        });
      return { webhook, payloads };
    });

    for await (const { webhook, payloads } of payloadsByHook) {
      for (const payload of payloads) {
        await this.sender.push({ webhook, payload, trigger });
      }
    }
  }
}
