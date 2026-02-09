import { Injectable } from '@nestjs/common';
import { ILogger, Logger } from '~/core/logger';
import { SkipLogging } from '../../exception/skip-logging.symbol';
import { type Webhook, type WebhookTrigger } from '../dto';
import { WebhookError, WebhookExecutor } from '../executor/webhook.executor';
import { WebhookSender } from '../webhook.sender';
import { WebhookChannelRepository } from './webhook-channel.repository';

@Injectable()
export class WebhookChannelService {
  constructor(
    private readonly repo: WebhookChannelRepository,
    private readonly executor: WebhookExecutor,
    private readonly sender: WebhookSender,
    @Logger('webhooks') private readonly logger: ILogger,
  ) {}

  async recalculate(webhook: Webhook, trigger: WebhookTrigger) {
    const error = await this.doCalculate(webhook).catch((e: Error) => {
      if (e instanceof WebhookError) {
        return e;
      }
      throw e;
    });
    if (!error) {
      return;
    }
    await this.markInvalid(webhook, error);
    // emit an error payload to the webhook, so it is notified
    await this.sender.push({
      webhook,
      payload: { errors: error.errors },
      trigger,
      fatal: true,
    });
  }

  async calculateOnUpsert(webhook: Webhook) {
    try {
      await this.doCalculate(webhook);
    } catch (error) {
      // Unwrap the webhook error and give directly to the user response which
      // is waiting on this upsert operation result.
      if (error instanceof WebhookError) {
        throw Object.assign(new AggregateError(error.errors), {
          [SkipLogging]: true,
        });
        // There's no need to mark the webhook invalid
        // because the upsert transaction will just roll back.
      }
      throw error;
    }
  }

  protected async doCalculate(webhook: Webhook) {
    const channels = await this.executor.collectChannels(webhook);
    await this.repo.save(webhook.id, channels);
  }

  async markInvalid(webhook: Webhook, error: WebhookError) {
    await this.repo.markInvalid(webhook.id);
    this.logger.warning('Saved webhook became invalid', {
      webhook: webhook.id,
      owner: webhook.owner.id,
      error,
    });
  }

  async listFor(channels: Iterable<string>) {
    return await this.repo.listForChannels(channels);
  }
}
