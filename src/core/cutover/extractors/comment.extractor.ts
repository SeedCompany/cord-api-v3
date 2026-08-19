import { type ID } from '~/common';
import { comments, commentThreads, users } from '~/core/drizzle/schema';
import { CommentRepository } from '../../../components/comments/comment.repository';
import { type Comment } from '../../../components/comments/dto';
import {
  bulkInsert,
  cypher,
  fetchIds,
  keepLanded,
  liveTargetIds,
  readAllViaRepo,
  recordReadLoss,
  resolveParentTypes,
  richText,
  stat,
  ts,
  tsReq,
} from '../cutover.helpers';
import { type Extractor, type TableStat } from '../cutover.types';

/**
 * Comment threads + comments. `(parent:BaseNode)-[:commentThread]->(:CommentThread)`,
 * `(thread)-[:comment { active }]->(:Comment)`, each with a `[:creator]->(:User)`.
 *
 * Threads are read by raw Cypher, comments through their repository — the split is
 * deliberate. `CommentThreadRepository.hydrate` returns only
 * `[comments[0], comments[-1]]` (first + latest, all the UI needs), so using it
 * would migrate two comments per thread and silently discard the middle of every
 * conversation. `CommentRepository.hydrate` has no such narrowing and no
 * authorization filter, so it is safe to read through.
 *
 * `parent_type` holds the CONCRETE typename and is resolved from the landed
 * Postgres rows, not from Neo4j labels — see {@link resolveParentTypes} for why the
 * labels can't be used. That resolution doubles as the parent guard: `parent_id` is
 * FK-less (parents span tables), so nothing would fail on a dangling thread; it
 * would just be permanently unreachable, since every read arrives via the parent.
 * A thread with no resolvable parent is therefore dropped rather than orphaned.
 *
 * `comments.body` is jsonb and NOT NULL, so an unparseable rich-text body has to
 * drop the row — there is no null to fall back to. Loud, since a lost comment is
 * lost user content.
 */
export const commentExtractor: Extractor = {
  name: 'comment',
  targetTables: ['comment_threads', 'comments'],
  dependsOn: ['user', 'project', 'language', 'partner', 'periodic-report'],
  async run(ctx) {
    const out: Record<string, TableStat> = {};

    // ── comment_threads ───────────────────────────────────────────────────────
    const threadRows = await cypher<{
      id: ID<'CommentThread'>;
      parentId: ID;
      creatorId: ID<'User'>;
      createdAt: string;
    }>(
      ctx,
      `MATCH (parent:BaseNode)-[:commentThread { active: true }]->(thread:CommentThread)
       MATCH (thread)-[:creator]->(creator:User)
       RETURN thread.id AS id, parent.id AS parentId, creator.id AS creatorId,
              toString(thread.createdAt) AS createdAt`,
    );
    // `parent:BaseNode` excludes threads under a soft-deleted parent (relabelled
    // `Deleted_BaseNode`) — 1 of 28 locally, under a deleted project. Enumerate
    // separately so that loss is stated rather than inferred.
    const allThreadIds = await fetchIds(ctx, 'CommentThread');
    recordReadLoss(
      ctx,
      'CommentThread',
      allThreadIds.length - threadRows.length,
      `${threadRows.length} of ${allThreadIds.length} had a live parent + creator, ` +
        `the rest hang off a soft-deleted parent or creator`,
    );

    const landedUsers = await liveTargetIds(ctx, 'User', users);
    const parentTypes = await resolveParentTypes(
      ctx,
      threadRows.map((row) => row.parentId),
    );
    const threadsKept = keepLanded(threadRows, [
      [landedUsers, (row) => row.creatorId],
      [new Set(parentTypes.keys()), (row) => row.parentId],
    ]);
    if (threadsKept.skipped > 0) {
      ctx.log(
        `    ⚠ DROPPED ${threadsKept.skipped} thread(s) whose creator never landed, or whose parent is not ` +
          `a live migrated resource (unreachable rather than invalid — parent_id is FK-less)`,
      );
    }

    out.comment_threads = stat(
      threadRows.length,
      await bulkInsert(
        ctx,
        commentThreads,
        threadsKept.kept.map((row) => ({
          id: row.id,
          parentId: row.parentId,
          parentType: parentTypes.get(row.parentId)!,
          creatorId: row.creatorId,
          createdAt: tsReq(row.createdAt),
        })),
      ),
    );

    // ── comments ──────────────────────────────────────────────────────────────
    const dtos = await readAllViaRepo<Comment>(
      ctx,
      'Comment',
      CommentRepository,
    );

    const landedThreads = new Set<string>(
      threadsKept.kept.map((row) => row.id),
    );
    const unparsedBodies: string[] = [];
    const commentValues = dtos.flatMap((comment) => {
      const dto = comment as unknown as Record<string, any>;
      const threadId = dto.thread as ID<'CommentThread'> | undefined;
      const creatorId = dto.creator as ID<'User'> | undefined;
      if (
        !threadId ||
        !landedThreads.has(threadId) ||
        !creatorId ||
        !landedUsers.has(creatorId)
      ) {
        return [];
      }
      const body = richText(dto.body);
      if (!body) {
        unparsedBodies.push(comment.id);
        return [];
      }
      return [
        {
          id: comment.id,
          threadId,
          creatorId,
          body: body as any,
          createdAt: tsReq(comment.createdAt),
          modifiedAt: ts(dto.modifiedAt) ?? tsReq(comment.createdAt),
        },
      ];
    });
    const droppedForParent =
      dtos.length - commentValues.length - unparsedBodies.length;
    if (droppedForParent > 0) {
      ctx.log(
        `    ⚠ DROPPED ${droppedForParent} comment(s) whose thread or creator never landed (both FKs)`,
      );
    }
    if (unparsedBodies.length > 0) {
      ctx.log(
        `    ⚠ DROPPED ${unparsedBodies.length} comment(s) whose rich-text body could not be parsed into ` +
          `jsonb, which is NOT NULL here so there is no null to fall back to — this is lost user content: ` +
          `${unparsedBodies.slice(0, 10).join(', ')}`,
      );
    }

    out.comments = stat(
      dtos.length,
      await bulkInsert(ctx, comments, commentValues),
    );

    return out;
  },
};
