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
import {
  CommonRepository,
  createUniqueConstraint,
  OnIndex,
} from '~/core/database';
import { collect, path, variable } from '~/core/database/query';
import { ILogger, Logger } from '~/core/logger';
import { type Webhook } from '../dto';
import { WebhooksRepository } from '../management/webhooks.repository';

@Injectable()
export class WebhookChannelRepository extends CommonRepository {
  constructor(
    private readonly webhooks: WebhooksRepository,
    @Logger('webhooks') private readonly logger: ILogger,
  ) {
    super();
  }

  @OnIndex()
  private createConstraints() {
    return [createUniqueConstraint('BroadcastChannel', 'name')];
  }

  async save(webhook: ID<'Webhook'>, channels: readonly string[]) {
    const query = this.db
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
          .return('collect(channel) as unobserved'),
      )

      .comment(
        'Cleanup channels that no longer have any webhooks observing them',
      )
      .subQuery('unobserved', (sub) =>
        sub
          .raw('UNWIND unobserved AS channel')
          .with(['channel', 'channel.name as name'])
          .where(
            not(
              path([
                node('channel'),
                relation('in', '', 'observes'),
                node('', 'Webhook'),
              ]),
            ),
          )
          .delete('channel')
          .return('collect(name) as orphaned'),
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
            relation('out', 'observes', 'observes'),
            node('channel'),
          ])
          .setValues({
            'observes.evaluatedAt': DateTime.now(),
          })
          .return('collect(channel.name) as observed'),
      )
      .return<{
        observed: readonly string[];
        unobserved: readonly string[];
        orphaned: readonly string[];
      }>([
        '[channel in unobserved | channel.name] as unobserved',
        'observed',
        'orphaned',
      ]);
    const result = await query.first();
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

  async listForChannels(channels: Iterable<string>) {
    return await this.db
      .query()
      .unwind([...channels], 'channelName')
      .match([
        node('node', 'Webhook', { valid: true }),
        relation('out', '', 'observes'),
        node('channel', 'BroadcastChannel', {
          name: variable('channelName'),
        }),
      ])
      .with(['distinct node', collect('channel.name').as('channels')])
      .subQuery('node', this.webhooks.hydrate())
      .return<{ webhook: Webhook; channels: readonly string[] }>([
        'dto as webhook',
        'channels',
      ])
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
