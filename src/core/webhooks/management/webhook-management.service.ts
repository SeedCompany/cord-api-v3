import { Injectable } from '@nestjs/common';
import { isEqual, omit, pick } from 'lodash';
import type { RequireExactlyOne } from 'type-fest';
import { type ID } from '~/common';
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
  constructor(private readonly repo: WebhooksRepository) {}

  async upsert(input: UpsertWebhookInput) {
    // TODO validate document
    const name = '' as ID<'Webhook'>; // TODO get name from document
    const key = input.key ?? name;

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

    // TODO compute channels

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
