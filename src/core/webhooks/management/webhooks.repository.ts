import { Injectable } from '@nestjs/common';
import { node, type Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { nanoid } from 'nanoid';
import { type RequireExactlyOne } from 'type-fest';
import { EnhancedResource, type ID } from '~/common';
import { DtoRepository } from '~/core/database';
import { currentUser, merge, randomUUID } from '~/core/database/query';
import { type UpsertWebhookInput, Webhook } from './dto';

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

  async save(input: UpsertWebhookInput & Pick<Webhook, 'key' | 'name'>) {
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
      .setValues({ node: { ...input, modifiedAt: DateTime.now() } }, true)
      .with('node')
      .apply(this.hydrate())
      .map((row) => row.dto);
    return (await query.first())!;
  }

  async deleteBy(
    filters: RequireExactlyOne<Pick<Webhook, 'id' | 'key' | 'name'>>,
  ) {
    await this.db
      .query()
      .apply(this.matchWebhook(filters))
      .detachDelete('node')
      .return('node')
      .executeAndLogStats();
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
