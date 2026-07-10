import { type ID } from '~/common';
import {
  notificationRecipients,
  notifications,
  notificationTypeEnum,
  users,
} from '~/core/drizzle/schema';
import { bulkInsert, cypher, liveTargetIds, stat } from '../cutover.helpers';
import { type Extractor, type TableStat } from '../cutover.types';

/**
 * Notifications + per-recipient read state. Pure Cypher — there's no
 * readMany-all repo surface (lists are per-recipient), and the node props are
 * direct (no Property nodes): `type` discriminator + `message` on the node,
 * `[:comment]` rel for mentions, `readAt` on the `[:recipient]` rel.
 *
 * Rows that would violate the `notifications_shape` CHECK (unknown type, or a
 * mention whose comment rel is gone) are dropped + logged — comments aren't a
 * PG domain yet, so `comment_id` is a deferred FK carrying the Neo4j id.
 */
export const notificationExtractor: Extractor = {
  name: 'notification',
  targetTables: ['notifications', 'notification_recipients'],
  dependsOn: ['user'],
  async run(ctx) {
    const out: Record<string, TableStat> = {};

    const userIds = await liveTargetIds(ctx, 'User', users);

    const nodes = await cypher<{
      id: ID;
      type: string;
      createdAt: string;
      message: string | null;
      creatorId: ID | null;
      commentId: ID | null;
    }>(
      ctx,
      `MATCH (n:Notification)
       OPTIONAL MATCH (n)-[:creator]->(c)
       OPTIONAL MATCH (n)-[:comment]->(cm:Comment)
       RETURN n.id AS id, n.type AS type, toString(n.createdAt) AS createdAt,
              n.message AS message, c.id AS creatorId, cm.id AS commentId`,
    );

    const knownTypes = new Set<string>(notificationTypeEnum.enumValues);
    let droppedShape = 0;
    let nulledCreators = 0;
    const rows = nodes.flatMap((n) => {
      const shapeOk =
        (n.type === 'System' && n.message != null && n.commentId == null) ||
        (n.type === 'CommentViaMention' &&
          n.commentId != null &&
          n.message == null);
      if (!knownTypes.has(n.type) || !shapeOk) {
        droppedShape++;
        return [];
      }
      // creator FK is ON DELETE SET NULL semantics — SystemAgent/absent
      // creators null out rather than dropping the notification.
      const creatorId =
        n.creatorId && userIds.has(n.creatorId) ? n.creatorId : null;
      if (n.creatorId && !creatorId) nulledCreators++;
      return [
        {
          id: n.id,
          type: n.type as (typeof notificationTypeEnum.enumValues)[number],
          createdAt: new Date(n.createdAt),
          creatorId,
          message: n.message,
          commentId: n.commentId,
        },
      ];
    });
    if (droppedShape) {
      ctx.log(
        `    ⚠ dropped ${droppedShape} notification(s) failing the shape check (unknown type / missing message / dangling comment)`,
      );
    }
    if (nulledCreators) {
      ctx.log(
        `    ⚠ nulled ${nulledCreators} SystemAgent/absent notification creator(s)`,
      );
    }
    out.notifications = stat(
      nodes.length,
      await bulkInsert(ctx, notifications, rows),
    );

    const insertedIds = new Set(rows.map((row) => row.id));
    const recipients = await cypher<{
      notificationId: ID;
      userId: ID;
      readAt: string | null;
    }>(
      ctx,
      `MATCH (n:Notification)-[r:recipient]->(u:User)
       RETURN n.id AS notificationId, u.id AS userId,
              toString(r.readAt) AS readAt`,
    );
    const recipientRows = recipients.flatMap((r) =>
      insertedIds.has(r.notificationId) && userIds.has(r.userId)
        ? [
            {
              notificationId: r.notificationId,
              userId: r.userId,
              readAt: r.readAt ? new Date(r.readAt) : null,
            },
          ]
        : [],
    );
    out.notification_recipients = stat(
      recipients.length,
      await bulkInsert(ctx, notificationRecipients, recipientRows),
    );

    return out;
  },
};
