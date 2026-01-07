import { Injectable } from '@nestjs/common';
import { type Webhook } from '../dto';
import { WebhookExecutor } from '../executor/webhook.executor';
import { WebhookChannelRepository } from './webhook-channel.repository';

@Injectable()
export class WebhookChannelService {
  constructor(
    private readonly repo: WebhookChannelRepository,
    private readonly executor: WebhookExecutor,
  ) {}

  async calculate(webhook: Webhook) {
    const channels = await this.executor.collectChannels(webhook);
    await this.repo.save(webhook.id, channels);
  }

  async listFor(channel: string) {
    return await this.repo.listForChannel(channel);
  }
}
