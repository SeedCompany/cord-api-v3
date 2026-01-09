import { Injectable } from '@nestjs/common';
import { isEqual, omit, pick } from 'lodash';
import type { RequireExactlyOne } from 'type-fest';
import { type ID } from '~/common';
import { WebhookChannelService } from '../channels/webhook-channel.service';
import { WebhookValidator } from '../webhook.validator';
import {
  type UpsertWebhookInput,
  type Webhook,
  type WebhookListInput,
} from './dto';
import { WebhooksRepository } from './webhooks.repository';

/**
 * Manages the user interaction to CRUD webhooks.
 */
@Injectable()
export class WebhookManagementService {
  constructor(
    private readonly repo: WebhooksRepository,
    private readonly validator: WebhookValidator,
    private readonly channels: WebhookChannelService,
  ) {}

  async upsert(input: UpsertWebhookInput) {
    const { name } = await this.validator.validate(input.document);
    const key = input.key ?? (name as ID<'Webhook'>);

    const existing = await this.repo.readByUserKey(key);
    if (
      existing &&
      isEqual(
        omit(input, ['key']),
        pick(existing, 'document', 'variables', 'url', 'metadata'),
      )
    ) {
      // No change, just return existing.
      return existing;
    }

    const webhook = await this.repo.save({
      ...input,
      key,
      name,
    });

    await this.channels.calculate(webhook);

    return webhook;
  }

  async rotateSecret() {
    return await this.repo.rotateSecret();
  }

  async deleteBy(
    filters: RequireExactlyOne<Pick<Webhook, 'id' | 'key' | 'name'>>,
  ) {
    await this.repo.deleteBy(filters);
  }

  async list(_input: WebhookListInput) {
    const items = await this.repo.listForUser();
    return {
      items,
      total: items.length,
      hasMore: false,
    };
  }
}
