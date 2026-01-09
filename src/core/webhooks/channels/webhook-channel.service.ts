import { Injectable } from '@nestjs/common';
import { type Webhook } from '../dto';
import { WebhookChannelRepository } from './webhook-channel.repository';

@Injectable()
export class WebhookChannelService {
  constructor(private readonly repo: WebhookChannelRepository) {}

  async calculate(webhook: Webhook) {
    const channels: string[] = []; // TODO compute channels
    await this.repo.save(webhook.id, channels);
  }

  async listFor(channel: string) {
    return await this.repo.listForChannel(channel);
  }
}
