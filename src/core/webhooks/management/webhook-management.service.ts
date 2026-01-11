import { printExecutableGraphQLDocument } from '@graphql-tools/documents';
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

  async upsert({ document: rawDocStr, ...input }: UpsertWebhookInput) {
    const { name, document: docNode } = await this.validator.validate(
      rawDocStr,
      input.key,
    );
    const normalizedDoc = printExecutableGraphQLDocument(docNode);

    const key = input.key ?? (name as ID<'Webhook'>);

    const existing = await this.repo.readByUserKey(key);
    if (
      existing &&
      normalizedDoc === existing.document &&
      isEqual(
        omit(input, ['key']),
        pick(existing, 'variables', 'url', 'metadata'),
      )
    ) {
      // No change, just return existing.
      return existing;
    }

    const webhook = await this.repo.save({
      ...input,
      document: normalizedDoc,
      key,
      name,
    });

    await this.channels.calculateOnUpsert(webhook);

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
