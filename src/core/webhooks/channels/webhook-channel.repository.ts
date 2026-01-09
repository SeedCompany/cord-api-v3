import { Injectable } from '@nestjs/common';
import { inArray, node, not, relation } from 'cypher-query-builder';
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

  async listForChannel(channel: string) {
    return await this.db
      .query()
      .match(node('node', 'Webhook'))
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
}
