import { Injectable } from '@nestjs/common';
import { node, type Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { nanoid } from 'nanoid';
import { EnhancedResource, type ID } from '~/common';
import { DtoRepository } from '~/core/database';
import {
  apoc,
  collect,
  currentUser,
  merge,
  randomUUID,
} from '~/core/database/query';
import { type DeleteWebhookArgs, Webhook, type WebhookConfig } from './dto';

/**
 * Each `User` can have multiple `Webhooks`.
 *
 * Each `User` can have a single `WebhookExecutor`, which is used to encapsulate
 * authentication/authorization for the user's webhook.
 * Currently, all this does is hold the `secret` that is used to sign the webhook POSTs.
 */
@Injectable()
export class WebhooksRepository extends DtoRepository(Webhook) {
  protected matchWebhook(filters?: Partial<Webhook>) {
    return (query: Query) =>
      query.match([
        currentUser,
        relation('out', 'rel', 'webhook'),
        node('node', 'Webhook', filters),
      ]);
  }

  hydrate() {
    return (query: Query) =>
      query
        .match([
          node('executor', 'WebhookExecutor'),
          relation('in', '', 'webhookExecutor'),
          node('owner', 'User'),
          relation('out', '', 'webhook'),
          node('node', 'Webhook'),
        ])
        .return<{ dto: Webhook }>(
          merge('node', {
            owner: 'owner { .id }',
            secret: 'executor.secret',
            metadata: apoc.convert.fromJsonMap('node.metadata'),
          }).as('dto'),
        );
  }

  async readByUserKey(key: ID) {
    return await this.db
      .query()
      .apply(this.matchWebhook({ key }))
      .apply(this.hydrate())
      .map((row) => row.dto)
      .first();
  }

  async listForUser() {
    return await this.db
      .query()
      .apply(this.matchWebhook())
      .apply(this.hydrate())
      .map((row) => row.dto)
      .run();
  }

  async save(input: WebhookConfig & Pick<Webhook, 'key' | 'name'>) {
    const maybeNewSecret = nanoid(32);
    const query = this.db
      .query()
      .match(currentUser.as('requestingUser'))
      .merge([
        node('requestingUser'),
        relation('out', '', 'webhookExecutor'),
        node('executor', 'WebhookExecutor'),
      ])
      .onCreate.set({
        values: { 'executor.secret': maybeNewSecret },
      })
      .merge([
        node('requestingUser'),
        relation('out', '', 'webhook'),
        node('node', EnhancedResource.of(Webhook).dbLabels, {
          key: input.key,
        }),
      ])
      .onCreate.set({
        variables: {
          'node.id': randomUUID(),
          'node.createdAt': 'datetime()',
        },
      })
      .setValues(
        {
          node: {
            ...input,
            valid: true,
            modifiedAt: DateTime.now(),
            metadata: input.metadata ? JSON.stringify(input.metadata) : null,
          },
        },
        true,
      )
      .with('node')
      .apply(this.hydrate())
      .map((row) => row.dto);
    return (await query.first())!;
  }

  async deleteBy(filters: Omit<DeleteWebhookArgs, 'all'>) {
    return await this.db
      .query()
      .apply(this.matchWebhook(filters))
      .subQuery('node', this.hydrate())

      // Cascade delete to orphaned channels
      .subQuery('node', (sub) =>
        sub
          .match([
            node('node'),
            relation('out', '', 'observes'),
            node('channel', 'BroadcastChannel'),
          ])
          .raw(
            `WHERE NOT EXISTS {
              MATCH (channel)<-[:observes]-(other:Webhook)
              WHERE other <> node
            }`,
          )
          .with(['channel', 'channel.name as name'])
          .detachDelete('channel')
          .return(collect('name').as('orphaned')),
      )

      .detachDelete('node')
      .return('dto')
      .map('dto')
      .run();
  }

  async rotateSecret() {
    const newSecret = nanoid(32);
    const query = this.db
      .query()
      .match(currentUser.as('requestingUser'))
      .merge([
        node('requestingUser'),
        relation('out', '', 'webhookExecutor'),
        node('executor', 'WebhookExecutor'),
      ])
      .with('executor')
      .set({
        values: { 'executor.secret': newSecret },
      })
      .return<{ secret: string }>('executor.secret as secret')
      .map((row) => row.secret);
    return (await query.first())!;
  }
}
