import { printExecutableGraphQLDocument } from '@graphql-tools/documents';
import { Injectable } from '@nestjs/common';
import { isEqual, omit, pick } from 'lodash';
import { type ID } from '~/common';
import { WebhookChannelService } from '../channels/webhook-channel.service';
import { WebhookSender } from '../webhook.sender';
import { WebhookValidator } from '../webhook.validator';
import {
  type DeleteWebhookArgs,
  type WebhookConfig,
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
    private readonly sender: WebhookSender,
    private readonly channels: WebhookChannelService,
  ) {}

  async save({ subscription: rawDocStr, ...input }: WebhookConfig) {
    const { name, document: docNode } = await this.validator.validate(
      rawDocStr,
      input.key,
    );
    const normalizedDoc = printExecutableGraphQLDocument(docNode);

    const key = input.key ?? (name as ID<'Webhook'>);

    const existing = await this.repo.readByUserKey(key);
    if (
      existing &&
      normalizedDoc === existing.subscription &&
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
      subscription: normalizedDoc,
      key,
      name,
    });

    await this.sender.verify(webhook);

    await this.channels.calculateOnUpsert(webhook);

    return webhook;
  }

  async rotateSecret() {
    return await this.repo.rotateSecret();
  }

  async deleteBy(filters: Omit<DeleteWebhookArgs, 'all'>) {
    return await this.repo.deleteBy(filters);
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
