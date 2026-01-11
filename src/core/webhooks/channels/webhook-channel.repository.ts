import { Injectable } from '@nestjs/common';
import {
  inArray,
  lessEqualTo,
  node,
  not,
  relation,
} from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { type ID, NotFoundException } from '~/common';
import { CommonRepository } from '~/core/database';
import { path, variable } from '~/core/database/query';
import { ILogger, Logger } from '~/core/logger';
import { WebhooksRepository } from '../management/webhooks.repository';

@Injectable()
export class WebhookChannelRepository extends CommonRepository {
  constructor(
    private readonly webhooks: WebhooksRepository,
    @Logger('webhooks') private readonly logger: ILogger,
  ) {
    super();
  }

  async save(webhook: ID<'Webhook'>, channels: readonly string[]) {
    const result = await this.db
      .query()
      .match(node('webhook', 'Webhook', { id: webhook }))

      .comment('Remove relationships not in the new list')
      .subQuery('webhook', (sub) =>
        sub
          .match([
            node('webhook'),
            relation('out', 'rel', 'observes'),
            node('channel', 'BroadcastChannel'),
          ])
          .where({ 'channel.name': not(inArray(channels)) })
          .delete('rel')
          .return('collect(channel.name) as unobserved'),
      )

      .comment(
        'Cleanup channels that no longer have any webhooks observing them',
      )
      .subQuery((sub) =>
        sub
          .match(node('channel', 'BroadcastChannel'))
          .where(
            not(
              path([
                node('channel'),
                relation('in', '', 'observes'),
                node('', 'Webhook'),
              ]),
            ),
          )
          .detachDelete('channel')
          .return('collect(channel.name) as orphaned'),
      )

      .comment('Upsert new channels & observations for the webhook')
      .subQuery('webhook', (sub) =>
        sub
          .unwind([...channels], 'channelName')
          .merge(
            node('channel', 'BroadcastChannel', {
              name: variable('channelName'),
            }),
          )
          .merge([
            node('webhook'),
            relation('out', '', 'observes', {
              evaluatedAt: DateTime.now(),
            }),
            node('channel'),
          ])
          .return('collect(channel.name) as observed'),
      )
      .return<{
        observed: readonly string[];
        unobserved: readonly string[];
        orphaned: readonly string[];
      }>(['unobserved', 'observed', 'orphaned'])
      .first();
    if (!result) {
      throw new NotFoundException('Webhook not found');
    }
    this.logger.debug(`Saved webhook channels`, { webhook, ...result });
  }

  async markInvalid(webhook: ID<'Webhook'>) {
    await this.db
      .query()
      .match(node('webhook', 'Webhook', { id: webhook }))
      .setValues({ 'webhook.valid': false })
      .executeAndLogStats();
  }

  async listForChannel(channel: string) {
    return await this.db
      .query()
      .match(node('node', 'Webhook', { valid: true }))
      .where(
        path([
          node('node'),
          relation('out', '', 'observes'),
          node('', 'BroadcastChannel', { name: channel }),
        ]),
      )
      .apply(this.webhooks.hydrate())
      .map((row) => row.dto)
      .run();
  }

  async listForWebhook(webhook: ID<'Webhook'>) {
    return await this.db
      .query()
      .match([
        node('node', 'Webhook', { id: webhook }),
        relation('out', '', 'observes'),
        node('channel', 'BroadcastChannel'),
      ])
      .return<{ channel: string }>('channel.name as channel')
      .map((row) => row.channel)
      .run();
  }

  async getStale(evaluatedAt: DateTime) {
    return await this.db
      .query()
      .match([
        node('node', 'Webhook', {
          // If we've already confirmed the webhook is invalid, we don't need
          // to reevaluate channels.
          // That will happen again when the consumer upserts with an updated operation.
          valid: true,
        }),
        relation('out', 'observes', 'observes'),
        node('', 'BroadcastChannel'),
      ])
      .where({ 'observes.evaluatedAt': lessEqualTo(evaluatedAt) })
      .with('distinct node')
      .apply(this.webhooks.hydrate())
      .map((row) => row.dto)
      .run();
  }
}
