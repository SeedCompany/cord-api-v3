import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { type Nil } from '@seedcompany/common';
import { and, count, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { omit } from 'lodash';
import { DateTime } from 'luxon';
import {
  EnhancedResource,
  generateId,
  type ID,
  NotFoundException,
  type ResourceShape,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { Identity } from '~/core/authentication';
import { DrizzleService } from '~/core/drizzle';
import { notificationRecipients, notifications } from '~/core/drizzle/schema';
import {
  type MarkNotificationReadArgs,
  Notification,
  type NotificationListInput,
} from './dto';
import { NotificationServiceImpl } from './notification.service';
import {
  type INotificationStrategy,
  type NotificationRow,
} from './notification.strategy';

/** A notifications row joined with the requesting user's per-recipient state. */
type RequesterRow = NotificationRow & { readAt: Date | null };

@Injectable()
export class NotificationDrizzleRepository {
  constructor(
    @Inject(forwardRef(() => NotificationServiceImpl))
    private readonly service: NotificationServiceImpl & {},
    private readonly drizzle: DrizzleService,
    private readonly identity: Identity,
  ) {}

  // Transaction-aware client — see DrizzleDtoRepository.db for why a getter.
  protected get db() {
    return this.drizzle.client;
  }

  async create(
    recipients: ReadonlyArray<ID<'User'>> | Nil,
    type: ResourceShape<any>,
    input: Record<string, any>,
  ) {
    const strategy = this.service.getStrategy(type);
    const extra = omit(input, [...EnhancedResource.of(Notification).props]);
    const id = await generateId<ID<'Notification'>>();

    await this.db.insert(notifications).values({
      id,
      type: this.getType(type),
      creatorId: this.identity.currentMaybe?.userId ?? null,
      ...strategy.saveForDrizzle(extra),
    });

    const recipientIds = recipients
      ? [...recipients]
      : [...(await strategy.recipientsForDrizzle(extra, this.db))];
    if (recipientIds.length > 0) {
      await this.db
        .insert(notificationRecipients)
        .values(recipientIds.map((userId) => ({ notificationId: id, userId })))
        .onConflictDoNothing();
    }

    return {
      dto: await this.readOne(id),
      totalRecipients: recipientIds.length,
      recipients: strategy.returnRecipientsFromDB() ? recipientIds : null,
    };
  }

  async markRead({ id, unread }: MarkNotificationReadArgs) {
    const userId = this.identity.current.userId;
    const updated = await this.db
      .update(notificationRecipients)
      .set({ readAt: unread ? null : new Date() })
      .where(
        and(
          eq(notificationRecipients.notificationId, id),
          eq(notificationRecipients.userId, userId),
        ),
      )
      .returning({ id: notificationRecipients.notificationId });
    if (updated.length === 0) {
      throw new NotFoundException();
    }
    return await this.readOne(id);
  }

  async list(input: NotificationListInput) {
    const userId = this.identity.current.userId;

    const conditions = [eq(notificationRecipients.userId, userId)];
    if (input.filter?.unread != null) {
      conditions.push(
        input.filter.unread
          ? isNull(notificationRecipients.readAt)
          : isNotNull(notificationRecipients.readAt),
      );
    }
    const predicate = and(...conditions);
    const offset = (input.page - 1) * input.count;

    const [countRows, unreadRows, rows] = await Promise.all([
      this.db
        .select({ total: count() })
        .from(notifications)
        .innerJoin(
          notificationRecipients,
          eq(notificationRecipients.notificationId, notifications.id),
        )
        .where(predicate),
      this.db
        .select({ total: count() })
        .from(notificationRecipients)
        .where(
          and(
            eq(notificationRecipients.userId, userId),
            isNull(notificationRecipients.readAt),
          ),
        ),
      this.db
        .select({ n: notifications, readAt: notificationRecipients.readAt })
        .from(notifications)
        .innerJoin(
          notificationRecipients,
          eq(notificationRecipients.notificationId, notifications.id),
        )
        .where(predicate)
        .orderBy(desc(notifications.createdAt), desc(notifications.id))
        .limit(input.count)
        .offset(offset),
    ]);

    const total = countRows[0]?.total ?? 0;
    return {
      items: rows.map((row) => this.mapRow({ ...row.n, readAt: row.readAt })),
      total,
      totalUnread: unreadRows[0]?.total ?? 0,
      hasMore: offset + rows.length < total,
    };
  }

  /**
   * Read a single notification with the requesting user's read state. Used
   * by create/markRead, so the requester may not be a recipient (e.g. the
   * author of a mention) — a missing recipient row reads as unread, matching
   * the Neo4j `optional match` behavior.
   */
  private async readOne(id: ID): Promise<UnsecuredDto<Notification>> {
    const userId = this.identity.currentMaybe?.userId;
    const [row] = await this.db
      .select({ n: notifications, readAt: notificationRecipients.readAt })
      .from(notifications)
      .leftJoin(
        notificationRecipients,
        and(
          eq(notificationRecipients.notificationId, notifications.id),
          userId ? eq(notificationRecipients.userId, userId) : sql`false`,
        ),
      )
      .where(eq(notifications.id, id));
    if (!row) {
      throw new NotFoundException();
    }
    return this.mapRow({ ...row.n, readAt: row.readAt });
  }

  private mapRow(row: RequesterRow): UnsecuredDto<Notification> {
    const strategy = this.strategyForType(row.type);
    const dto: unknown = {
      id: row.id,
      createdAt: DateTime.fromJSDate(row.createdAt),
      __typename: `${row.type}Notification`,
      unread: row.readAt === null,
      readAt: row.readAt ? DateTime.fromJSDate(row.readAt) : null,
      ...strategy.hydrateExtraForDrizzle(row),
    };
    return dto as UnsecuredDto<Notification>;
  }

  private strategyForType(type: string): INotificationStrategy<Notification> {
    for (const [dtoCls, strategy] of this.service.strategyMap) {
      if (this.getType(dtoCls) === type) {
        return strategy;
      }
    }
    throw new ServerException(
      `No notification strategy registered for type ${type}`,
    );
  }

  private getType(dtoCls: ResourceShape<Notification>) {
    return dtoCls.name.replace(
      'Notification',
      '',
    ) as (typeof notifications.type.enumValues)[number];
  }
}
