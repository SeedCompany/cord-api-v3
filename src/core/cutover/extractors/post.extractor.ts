import { type ID } from '~/common';
import {
  posts,
  postShareabilityEnum,
  postTypeEnum,
  users,
} from '~/core/drizzle/schema';
import {
  bulkInsert,
  cypher,
  fetchIds,
  keepLanded,
  liveTargetIds,
  one,
  recordReadLoss,
  resolveParentTypes,
  sanitizeEnum,
  tsReq,
} from '../cutover.helpers';
import { type Extractor } from '../cutover.types';

/**
 * Posts — notes / stories / prayers attached to a Language, Partner or Project.
 *
 * ⚠ **Read by raw Cypher, NOT through PostRepository — this is the one repository
 * in the harness that must not be used.** `PostRepository.readMany` applies
 * `filterAuthorized()`, and that filter is not a policy check the root session can
 * satisfy: it is hardcoded Cypher requiring the current user to be a *member* of
 * the post's parent —
 * `(node)<-[:post]-(:BaseNode)-[:member]-(:BaseNode)-[:user]->(:User { id: $currentUser })`.
 * There is no privileges escape in a raw graph pattern, so every
 * `Membership`-shareability post whose parent the root user isn't a member of would
 * be dropped. Silently: the read stat counts what came back.
 *
 * The distinction that makes this the only case: other repositories filter with
 * `privileges.filterToReadable()`, which root's global grants DO satisfy — proven
 * empirically, since project/engagement/language all read their full node counts
 * through readMany. Post's is a membership traversal, not a grant.
 *
 * It also cannot be caught locally: all 8 local posts are `Internal`, so the filter
 * currently drops nothing here. A prod run is where it would have bitten.
 *
 * `parent_type` resolution and the FK-less-parent guard work exactly as in the
 * comment extractor. `posts.body` is plain `text` (Post.body is a SecuredString,
 * not rich text) so it needs no jsonb conversion — unlike comments.
 */
export const postExtractor: Extractor = {
  name: 'post',
  targetTables: ['posts'],
  dependsOn: ['user', 'project', 'language', 'partner'],
  async run(ctx) {
    const rows = await cypher<{
      id: ID<'Post'>;
      parentId: ID;
      creatorId: ID<'User'>;
      type: string | null;
      shareability: string | null;
      body: string | null;
      createdAt: string;
      modifiedAt: string | null;
    }>(
      ctx,
      `MATCH (parent:BaseNode)-[:post { active: true }]->(post:Post)
       MATCH (post)-[:creator]->(creator:User)
       MATCH (post)-[:type { active: true }]->(type:Property)
       MATCH (post)-[:shareability { active: true }]->(shareability:Property)
       MATCH (post)-[:body { active: true }]->(body:Property)
       OPTIONAL MATCH (post)-[:modifiedAt { active: true }]->(modifiedAt:Property)
       RETURN post.id AS id, parent.id AS parentId, creator.id AS creatorId,
              type.value AS type, shareability.value AS shareability, body.value AS body,
              toString(post.createdAt) AS createdAt, toString(modifiedAt.value) AS modifiedAt`,
    );
    // Every match above is required, so a post missing any of them vanishes from
    // the result exactly like an empty domain. Enumerate to make that visible.
    const allIds = await fetchIds(ctx, 'Post');
    recordReadLoss(
      ctx,
      'Post',
      allIds.length - rows.length,
      `${rows.length} of ${allIds.length} matched the parent + creator + type/shareability/body joins, ` +
        `the rest are lost to a soft-deleted parent or creator, or a missing required property`,
    );

    const landedUsers = await liveTargetIds(ctx, 'User', users);
    const parentTypes = await resolveParentTypes(
      ctx,
      rows.map((row) => row.parentId),
    );
    const kept = keepLanded(rows, [
      [landedUsers, (row) => row.creatorId],
      [new Set(parentTypes.keys()), (row) => row.parentId],
    ]);
    if (kept.skipped > 0) {
      ctx.log(
        `    ⚠ DROPPED ${kept.skipped} post(s) whose creator never landed, or whose parent is not a live ` +
          `migrated resource (unreachable rather than invalid — parent_id is FK-less)`,
      );
    }

    const droppedEnums = new Set<string>();
    const droppedForShape: string[] = [];
    const values = kept.kept.flatMap((row) => {
      const type = sanitizeEnum([String(row.type)], postTypeEnum.enumValues);
      const shareability = sanitizeEnum(
        [String(row.shareability)],
        postShareabilityEnum.enumValues,
      );
      for (const [label, result] of [
        ['type', type],
        ['shareability', shareability],
      ] as const) {
        for (const value of result.dropped) {
          droppedEnums.add(`${label}=${value}`);
        }
      }
      // All three are NOT NULL with no sensible default: a post with no body or an
      // unrecognized type is not a post.
      if (!type.kept[0] || !shareability.kept[0] || row.body == null) {
        droppedForShape.push(row.id);
        return [];
      }
      return [
        {
          id: row.id,
          parentId: row.parentId,
          parentType: parentTypes.get(row.parentId)!,
          creatorId: row.creatorId,
          type: type.kept[0],
          shareability: shareability.kept[0],
          body: row.body,
          createdAt: tsReq(row.createdAt),
          modifiedAt: tsReq(row.modifiedAt ?? row.createdAt),
        },
      ];
    });
    if (droppedForShape.length > 0) {
      ctx.log(
        `    ⚠ DROPPED ${droppedForShape.length} post(s) missing a body or carrying an unrecognized ` +
          `type/shareability (all three NOT NULL): ${droppedForShape.slice(0, 10).join(', ')}`,
      );
    }
    if (droppedEnums.size > 0) {
      ctx.log(
        `    ⚠ unknown post enum value(s): ${[...droppedEnums].join(', ')} — migration-todo: map, don't drop. ` +
          `Note 'ProjectTeam' IS a legal shareability (deprecated alias for Membership, stored verbatim)`,
      );
    }

    return one('posts', rows.length, await bulkInsert(ctx, posts, values));
  },
};
