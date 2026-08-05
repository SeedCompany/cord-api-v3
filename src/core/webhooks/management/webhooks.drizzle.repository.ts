import { Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { nanoid } from 'nanoid';
import { generateId, type ID } from '~/common';
import { Identity } from '~/core/authentication';
import { DrizzleService } from '~/core/drizzle';
import {
  webhookChannelObservations,
  webhookExecutors,
  webhooks,
} from '~/core/drizzle/schema';
import { cleanupOrphanedChannels } from '../channels/cleanup-orphaned-channels';
import {
  type DeleteWebhookArgs,
  type Webhook,
  type WebhookConfig,
} from './dto';

type WebhookRow = typeof webhooks.$inferSelect;

/**
 * Every read/write here is scoped to `identity.current.userId` — there is no
 * ResourceMap entry or policy grant for Webhook, so this owner scoping *is*
 * the entire access control. Neo4j gets this for free by always traversing
 * from `currentUser`; nothing else stands in for that here.
 */
@Injectable()
export class WebhooksDrizzleRepository {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly identity: Identity,
  ) {}

  protected get db() {
    return this.drizzle.client;
  }

  private async getSecret(userId: ID<'User'>): Promise<string> {
    const [row] = await this.db
      .select({ secret: webhookExecutors.secret })
      .from(webhookExecutors)
      .where(eq(webhookExecutors.userId, userId));
    return row?.secret ?? '';
  }

  private toDto(row: WebhookRow, secret: string): Webhook {
    const dto: Webhook = {
      id: row.id,
      key: row.key,
      owner: { id: row.ownerId },
      name: row.name,
      subscription: row.subscription,
      variables: row.variables ?? undefined,
      url: row.url,
      metadata: row.metadata ?? undefined,
      secret,
      createdAt: DateTime.fromJSDate(row.createdAt),
      modifiedAt: DateTime.fromJSDate(row.modifiedAt),
      valid: row.valid,
    };
    return dto;
  }

  async readByUserKey(key: ID<'Webhook'>): Promise<Webhook | undefined> {
    const userId = this.identity.current.userId;
    const [row] = await this.db
      .select()
      .from(webhooks)
      .where(and(eq(webhooks.ownerId, userId), eq(webhooks.key, key)));
    if (!row) return undefined;
    return this.toDto(row, await this.getSecret(userId));
  }

  async listForUser(): Promise<Webhook[]> {
    const userId = this.identity.current.userId;
    const rows = await this.db
      .select()
      .from(webhooks)
      .where(eq(webhooks.ownerId, userId));
    if (rows.length === 0) return [];
    const secret = await this.getSecret(userId);
    return rows.map((row) => this.toDto(row, secret));
  }

  /** Hydrates webhooks that may span multiple owners — used by the channel repo. */
  async readManyByIds(ids: ReadonlyArray<ID<'Webhook'>>): Promise<Webhook[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(webhooks)
      .where(inArray(webhooks.id, [...ids]));
    if (rows.length === 0) return [];
    const ownerIds = [...new Set(rows.map((row) => row.ownerId))];
    const executors = await this.db
      .select()
      .from(webhookExecutors)
      .where(inArray(webhookExecutors.userId, ownerIds));
    const secretByOwner = new Map(
      executors.map((row) => [row.userId, row.secret]),
    );
    return rows.map((row) =>
      this.toDto(row, secretByOwner.get(row.ownerId) ?? ''),
    );
  }

  /**
   * Upsert-by-(owner, key): the executor is bootstrapped once (its secret is
   * left alone if it already exists — resaving a webhook must not rotate the
   * secret), then the webhook row is fully overwritten, matching Neo4j's
   * `setValues(..., true)` semantics of replacing every field on every save.
   */
  async save(
    input: WebhookConfig & Pick<Webhook, 'key' | 'name'>,
  ): Promise<Webhook> {
    const userId = this.identity.current.userId;

    await this.db
      .insert(webhookExecutors)
      .values({ userId, secret: nanoid(32) })
      .onConflictDoNothing();

    const now = new Date();
    const [row] = await this.db
      .insert(webhooks)
      .values({
        id: await generateId<ID<'Webhook'>>(),
        ownerId: userId,
        key: input.key,
        name: input.name,
        subscription: input.subscription,
        variables: input.variables ?? null,
        url: input.url,
        metadata: input.metadata ?? null,
        valid: true,
        createdAt: now,
        modifiedAt: now,
      })
      .onConflictDoUpdate({
        target: [webhooks.ownerId, webhooks.key],
        set: {
          name: input.name,
          subscription: input.subscription,
          variables: input.variables ?? null,
          url: input.url,
          metadata: input.metadata ?? null,
          valid: true,
          modifiedAt: now,
        },
      })
      .returning();

    return this.toDto(row!, await this.getSecret(userId));
  }

  async deleteBy(
    filters: Omit<DeleteWebhookArgs, 'all'>,
  ): Promise<readonly Webhook[]> {
    const userId = this.identity.current.userId;
    const conditions = [eq(webhooks.ownerId, userId)];
    if (filters.id) conditions.push(eq(webhooks.id, filters.id));
    if (filters.key) conditions.push(eq(webhooks.key, filters.key));
    if (filters.name) conditions.push(eq(webhooks.name, filters.name));
    const predicate = and(...conditions);

    // Cascade removes the observation rows; capture the channel names first
    // so orphans among them can be cleaned up after.
    const observedChannels = await this.db
      .selectDistinct({ name: webhookChannelObservations.channelName })
      .from(webhookChannelObservations)
      .innerJoin(
        webhooks,
        eq(webhooks.id, webhookChannelObservations.webhookId),
      )
      .where(predicate);

    const rows = await this.db.delete(webhooks).where(predicate).returning();
    if (rows.length === 0) return [];

    await cleanupOrphanedChannels(
      this.db,
      observedChannels.map((row) => row.name),
    );

    const secret = await this.getSecret(userId);
    return rows.map((row) => this.toDto(row, secret));
  }

  /** Rotates the secret shared by every webhook the current user owns. */
  async rotateSecret(): Promise<string> {
    const userId = this.identity.current.userId;
    const secret = nanoid(32);
    const [row] = await this.db
      .insert(webhookExecutors)
      .values({ userId, secret })
      .onConflictDoUpdate({
        target: webhookExecutors.userId,
        set: { secret, updatedAt: new Date() },
      })
      .returning({ secret: webhookExecutors.secret });
    return row!.secret;
  }
}
