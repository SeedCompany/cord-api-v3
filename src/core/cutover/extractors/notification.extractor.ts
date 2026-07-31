import { type ID } from '~/common';
import {
  comments,
  notificationRecipients,
  notifications,
  notificationTypeEnum,
  users,
} from '~/core/drizzle/schema';
import {
  bulkInsert,
  cypher,
  liveTargetIds,
  stat,
  warnIfRelTypeUnknown,
} from '../cutover.helpers';
import { type Extractor, type TableStat } from '../cutover.types';

/**
 * Notifications + per-recipient read state. Pure Cypher — there's no
 * readMany-all repo surface (lists are per-recipient), and the node props are
 * direct (no Property nodes): `type` discriminator + `message` on the node,
 * `[:comment]` rel for mentions, `readAt` on the `[:recipient]` rel.
 *
 * Rows that would violate the `notifications_shape` CHECK (unknown type, or a
 * mention whose comment rel is gone) are dropped + logged.
 *
 * `comment_id` is a REAL FK to `comments`, added with the Comments migration
 * (0024) — after this extractor was first written, when the docblock could still
 * say "comments aren't a PG domain yet, so it's a deferred FK". Two consequences
 * that the original version missed, both load-aborting:
 *  - `dependsOn` must include `comment`, or the topological sort is free to run
 *    this extractor at its registration position (ahead of `comment`) and every
 *    mention violates the FK against an empty table.
 *  - A mention whose comment never landed must be DROPPED, not nulled: the
 *    `notifications_shape` CHECK requires `comment_id IS NOT NULL` for that type.
 */
export const notificationExtractor: Extractor = {
  name: 'notification',
  targetTables: ['notifications', 'notification_recipients'],
  dependsOn: ['user', 'comment'],
  async run(ctx) {
    const out: Record<string, TableStat> = {};

    const userIds = await liveTargetIds(ctx, 'User', users);
    const landedComments = await liveTargetIds(ctx, 'Comment', comments);

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
    let droppedForComment = 0;
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
      // Drop rather than null: comment_id FKs to comments, and the shape CHECK
      // requires it non-null for a mention, so there is no salvageable row. A
      // comment goes missing when its thread's parent was soft-deleted or its
      // creator never landed — see comment.extractor's own guards.
      if (n.commentId && !landedComments.has(n.commentId)) {
        droppedForComment++;
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
    if (droppedForComment) {
      ctx.log(
        `    ⚠ DROPPED ${droppedForComment} mention notification(s) whose comment never landed (comment_id FK + shape CHECK)`,
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
    // Edge-stored, so a wrong type name reconciles 0 == 0 == 0 with a ✓. Prod
    // has notifications but ZERO `recipient` edges, which is exactly the
    // ambiguity this guard exists to name: `db.relationshipTypes()` decides
    // whether the domain is empty or the query is broken.
    if (recipients.length === 0) {
      await warnIfRelTypeUnknown(ctx, 'recipient');
    }
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
