import { Injectable } from '@nestjs/common';
import { and, eq, inArray, lte } from 'drizzle-orm';
import { type DateTime } from 'luxon';
import { type ID, NotFoundException } from '~/common';
import { DrizzleService } from '~/core/drizzle';
import {
  broadcastChannels,
  webhookChannelObservations,
  webhooks,
} from '~/core/drizzle/schema';
import { type Webhook } from '../dto';
import { WebhooksDrizzleRepository } from '../management/webhooks.drizzle.repository';
import { cleanupOrphanedChannels } from './cleanup-orphaned-channels';

@Injectable()
export class WebhookChannelDrizzleRepository {
  constructor(
    private readonly drizzle: DrizzleService,
    // Injected concretely (not via the WebhookChannelRepository token): only
    // this repo needs the Postgres-specific hydration below, and there's no
    // cycle back the other way (WebhooksDrizzleRepository doesn't depend on
    // this one) — same shape as CommentThreadDrizzleRepository being injected
    // concretely into CommentDrizzleRepository.
    private readonly webhooks: WebhooksDrizzleRepository,
  ) {}

  protected get db() {
    return this.drizzle.client;
  }

  /** Recomputes the full set of channels a webhook observes. */
  async save(
    webhook: ID<'Webhook'>,
    channels: readonly string[],
  ): Promise<void> {
    const [exists] = await this.db
      .select({ id: webhooks.id })
      .from(webhooks)
      .where(eq(webhooks.id, webhook));
    if (!exists) {
      throw new NotFoundException('Webhook not found');
    }

    const current = await this.db
      .select({ name: webhookChannelObservations.channelName })
      .from(webhookChannelObservations)
      .where(eq(webhookChannelObservations.webhookId, webhook));
    const currentNames = current.map((row) => row.name);
    const nextNames = [...new Set(channels)];

    const toRemove = currentNames.filter((name) => !nextNames.includes(name));
    if (toRemove.length > 0) {
      await this.db
        .delete(webhookChannelObservations)
        .where(
          and(
            eq(webhookChannelObservations.webhookId, webhook),
            inArray(webhookChannelObservations.channelName, toRemove),
          ),
        );
      await cleanupOrphanedChannels(this.db, toRemove);
    }

    if (nextNames.length > 0) {
      await this.db
        .insert(broadcastChannels)
        .values(nextNames.map((name) => ({ name })))
        .onConflictDoNothing();

      const evaluatedAt = new Date();
      await this.db
        .insert(webhookChannelObservations)
        .values(
          nextNames.map((name) => ({
            webhookId: webhook,
            channelName: name,
            evaluatedAt,
          })),
        )
        .onConflictDoUpdate({
          target: [
            webhookChannelObservations.webhookId,
            webhookChannelObservations.channelName,
          ],
          set: { evaluatedAt },
        });
    }
  }

  async markInvalid(webhook: ID<'Webhook'>): Promise<void> {
    await this.db
      .update(webhooks)
      .set({ valid: false })
      .where(eq(webhooks.id, webhook));
  }

  async listForChannels(
    channels: Iterable<string>,
  ): Promise<ReadonlyArray<{ webhook: Webhook; channels: readonly string[] }>> {
    const names = [...channels];
    if (names.length === 0) return [];
    const rows = await this.db
      .select({
        webhookId: webhookChannelObservations.webhookId,
        channelName: webhookChannelObservations.channelName,
      })
      .from(webhookChannelObservations)
      .innerJoin(
        webhooks,
        eq(webhooks.id, webhookChannelObservations.webhookId),
      )
      .where(
        and(
          eq(webhooks.valid, true),
          inArray(webhookChannelObservations.channelName, names),
        ),
      );

    const channelsByWebhook = new Map<ID<'Webhook'>, string[]>();
    for (const row of rows) {
      const list = channelsByWebhook.get(row.webhookId) ?? [];
      list.push(row.channelName);
      channelsByWebhook.set(row.webhookId, list);
    }

    const hydrated = await this.webhooks.readManyByIds([
      ...channelsByWebhook.keys(),
    ]);
    return hydrated.map((webhook) => ({
      webhook,
      channels: channelsByWebhook.get(webhook.id)!,
    }));
  }

  async listForWebhook(webhook: ID<'Webhook'>): Promise<readonly string[]> {
    const rows = await this.db
      .select({ name: webhookChannelObservations.channelName })
      .from(webhookChannelObservations)
      .where(eq(webhookChannelObservations.webhookId, webhook));
    return rows.map((row) => row.name);
  }

  async getStale(evaluatedAt: DateTime): Promise<Webhook[]> {
    const rows = await this.db
      .selectDistinct({ webhookId: webhookChannelObservations.webhookId })
      .from(webhookChannelObservations)
      .innerJoin(
        webhooks,
        eq(webhooks.id, webhookChannelObservations.webhookId),
      )
      .where(
        and(
          eq(webhooks.valid, true),
          lte(webhookChannelObservations.evaluatedAt, evaluatedAt.toJSDate()),
        ),
      );
    return await this.webhooks.readManyByIds(rows.map((row) => row.webhookId));
  }
}
