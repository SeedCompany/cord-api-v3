import { Injectable } from '@nestjs/common';
import { and, asc, inArray, isNull } from 'drizzle-orm';
import { type ID } from '~/common';
import { Identity } from '~/core/authentication';
import { DrizzleService } from '~/core/drizzle';
import { posts } from '~/core/drizzle/schema';
import { LiveQueryStore } from '~/core/live-query';
import { type PostShareability } from './dto';

/**
 * Reads and writes for post moderation.
 *
 * Deliberately NOT behind `splitDb`. Moderation exists only for
 * partner-submitted content, which is Postgres-only, so there is no Neo4j
 * counterpart and inventing one — even a throwing stub — would put new code in
 * a backend that is being retired. Injecting {@link DrizzleService} directly
 * keeps the whole feature on one path.
 *
 * It does not extend `DrizzleDtoRepository` either: hydrating a Post is already
 * the split repository's job, so this returns ids and lets the caller read
 * through the normal path. That keeps one hydration implementation rather than
 * two that can drift.
 */
@Injectable()
export class PostModerationDrizzleRepository {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly identity: Identity,
    private readonly liveQueryStore: LiveQueryStore,
  ) {}

  /**
   * `client`, not the pool directly, so these writes join whatever transaction
   * the calling mutation opened rather than running beside it.
   */
  private get db() {
    return this.drizzle.client;
  }

  /**
   * Record a clearance on several posts at once.
   *
   * One statement rather than a loop: the queue's normal interaction is
   * clearing a batch, and looping would turn one round trip into dozens while
   * making partial failure a reachable state.
   */
  async clear(
    ids: ReadonlyArray<ID<'Post'>>,
    shareability: PostShareability,
  ): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(posts)
      .set({
        approvedShareability: shareability,
        approvedById: this.identity.current.userId,
        approvedAt: new Date(),
      })
      .where(inArray(posts.id, ids as Array<ID<'Post'>>));
    for (const id of ids) {
      this.liveQueryStore.invalidate(['Post', id]);
    }
  }

  /**
   * Ids of posts on these parents that nobody has cleared yet.
   *
   * Takes parents rather than a reviewer, because who may review is a policy
   * question the service answers — this only needs to know where to look. Rows
   * come back oldest first: the queue is a backlog, and the thing most at risk
   * of being forgotten is the oldest item, not the newest.
   */
  async findAwaitingReview(
    parentIds: readonly ID[],
  ): Promise<Array<ID<'Post'>>> {
    if (parentIds.length === 0) return [];
    const rows = await this.db
      .select({ id: posts.id })
      .from(posts)
      .where(
        and(
          inArray(posts.parentId, parentIds as ID[]),
          isNull(posts.approvedShareability),
        ),
      )
      .orderBy(asc(posts.createdAt), asc(posts.id));
    return rows.map((row: { id: ID<'Post'> }) => row.id);
  }
}
