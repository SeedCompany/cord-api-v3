import { Injectable } from '@nestjs/common';
import {
  and,
  asc,
  count,
  eq,
  getTableColumns,
  inArray,
  isNull,
  ne,
  type SQL,
  sql,
} from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  generateId,
  type ID,
  NotFoundException,
  type UnsecuredDto,
} from '~/common';
import { Identity } from '~/core/authentication';
import { type ChangesOf } from '~/core/database/changes';
import {
  DrizzleDtoRepository,
  DrizzleService,
  resolveOrderBy,
  resolveResourceBaseNode,
  type SortMap,
} from '~/core/drizzle';
import {
  engagements,
  periodicReports,
  posts,
  projectMembers,
} from '~/core/drizzle/schema';
import { type BaseNode } from '~/core/resources';
import {
  type CreatePost,
  needsModeration,
  Post,
  type PostShareability,
  type UpdatePost,
} from './dto';
import { type PostListInput } from './dto/list-posts.dto';

type PostRow = typeof posts.$inferSelect & {
  /**
   * `report_id` re-resolved to the LIVE report for the same period, or null
   * when the referenced report is gone for good. See {@link PostRepository.columns}.
   */
  liveReportId: ID<'PeriodicReport'> | null;
};

@Injectable()
export class PostRepository extends DrizzleDtoRepository<typeof posts, Post> {
  constructor(
    drizzle: DrizzleService,
    private readonly identity: Identity,
  ) {
    super(drizzle, posts, Post);
  }

  /**
   * Every post read selects these.
   *
   * `liveReportId` exists because periodic reports are soft-deleted: shrinking
   * an engagement's date range and widening it again re-creates the quarter
   * under a NEW row id (the dead row still holds the deterministic one), and
   * `ON DELETE SET NULL` never fires on a soft delete. So a post's `report_id`
   * can point at a dead row while a live report for the very same period
   * exists. Rather than repair rows, the read follows the period: the
   * referenced row's `(engagement_id, type, start, end)` to the live row with
   * that key — which, for a report that is still live, is itself. The partial
   * unique index `periodic_reports_live_interval_unique` guarantees at most
   * one match.
   */
  private get columns() {
    return {
      ...getTableColumns(posts),
      liveReportId: sql<ID<'PeriodicReport'> | null>`(
        select "live"."id"
        from ${periodicReports} as "dead"
        join ${periodicReports} as "live"
          on "live"."engagement_id" = "dead"."engagement_id"
         and "live"."type" = "dead"."type"
         and "live"."start" = "dead"."start"
         and "live"."end" = "dead"."end"
         and "live"."deleted_at" is null
        where "dead"."id" = ${posts.reportId}
      )`.as('live_report_id'),
    };
  }

  protected toDto(row: PostRow): UnsecuredDto<Post> {
    const dto: unknown = {
      id: row.id,
      createdAt: DateTime.fromJSDate(row.createdAt),
      // Fake BaseNode so ResourceLoader.loadByBaseNode resolves the parent.
      parent: {
        identity: row.parentId,
        labels: [row.parentType, 'BaseNode'],
        properties: {
          id: row.parentId,
          createdAt: DateTime.fromJSDate(row.createdAt),
        },
      },
      creator: { id: row.creatorId },
      type: row.type,
      shareability: row.shareability,
      approvedShareability: row.approvedShareability ?? null,
      approvedBy: row.approvedById ? { id: row.approvedById } : null,
      approvedAt: row.approvedAt ? DateTime.fromJSDate(row.approvedAt) : null,
      report: row.liveReportId ? { id: row.liveReportId } : null,
      body: row.body,
      finalBody: row.finalBody ?? null,
      featured: row.featured,
      modifiedAt: DateTime.fromJSDate(row.modifiedAt),
    };
    return dto as UnsecuredDto<Post>;
  }

  async create(input: CreatePost): Promise<{ dto: UnsecuredDto<Post> }> {
    const parentNode = await resolveResourceBaseNode(this.db, input.parent);
    if (!parentNode) {
      throw new NotFoundException('Resource does not exist', 'parent');
    }
    const id = await generateId<ID<'Post'>>();
    // Reach that never leaves Seed Company is cleared on the way in, so the
    // moderation queue only ever holds decisions a human actually has to make.
    const selfClearing = !needsModeration(input.shareability);
    await this.db.insert(posts).values({
      id,
      parentId: input.parent,
      parentType: parentNode.labels[0]!,
      creatorId: this.identity.current.userId,
      type: input.type,
      shareability: input.shareability,
      approvedShareability: selfClearing ? input.shareability : null,
      approvedAt: selfClearing ? new Date() : null,
      reportId: input.report ?? null,
      body: input.body,
    });
    // Hydrated without the auth filter — the create path returns the post
    // directly to its creator.
    return { dto: await this.hydrateOne(id) };
  }

  async update(
    existing: UnsecuredDto<Post>,
    changes: ChangesOf<Post, UpdatePost>,
  ): Promise<UnsecuredDto<Post>> {
    // Changing the requested reach re-opens the question of clearance. Up to
    // a level that needs a moderator, any prior approval is reset — otherwise
    // a post approved at Internal could be edited to External and keep the old
    // approval, which is the one way this model could leak. Down to a level
    // that never needed one, it self-clears at the new reach, exactly as a
    // fresh post would — otherwise an author narrowing their request would
    // leave a wider clearance standing.
    const shareability = changes.shareability;
    const moderation =
      shareability === undefined
        ? {}
        : needsModeration(shareability)
          ? { approvedShareability: null, approvedById: null, approvedAt: null }
          : {
              approvedShareability: shareability,
              approvedById: null,
              approvedAt: new Date(),
            };
    await this.updateColumns(existing.id, {
      type: changes.type,
      shareability,
      body: changes.body,
      featured: changes.featured,
      // `report` and `finalBody` are both explicitly nullable — passing null
      // detaches the report, or clears a finalized wording back to `body`.
      // `undefined` (the key absent from `changes`) means "don't touch".
      ...('report' in changes ? { reportId: changes.report ?? null } : {}),
      ...('finalBody' in changes
        ? { finalBody: changes.finalBody ?? null }
        : {}),
      ...moderation,
      // Injected by getActualChanges upstream; enumerating columns here
      // without it froze every post's modifiedAt at creation (audit LPOST-1).
      modifiedAt: changes.modifiedAt?.toJSDate(),
    });
    return await this.hydrateOne(existing.id);
  }

  /**
   * Record a moderator's clearance on several posts at once.
   *
   * One statement rather than a loop: the queue's normal interaction is
   * clearing a batch. Hand-rolled (not `updateColumns`, which is per row), so
   * it invalidates the live-query store itself — see the base class's doc
   * comment on why the base can't cover this.
   */
  async clearModeration(
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
      .where(inArray(posts.id, [...ids]));
    for (const id of ids) {
      this.liveQueryStore.invalidate(['Post', id]);
    }
  }

  /**
   * How many OTHER posts on this report are already featured. Backs the
   * "up to N in the Investor Report" cap in PostService — a product decision
   * that could change, so it is checked there rather than by a DB constraint.
   */
  async countFeatured(
    reportId: ID<'PeriodicReport'>,
    excluding: ID<'Post'>,
  ): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(posts)
      .where(
        and(
          eq(posts.reportId, reportId),
          eq(posts.featured, true),
          ne(posts.id, excluding),
        ),
      );
    return row?.total ?? 0;
  }

  /** The live report with this id and the engagement it hangs off, if any. */
  async readLiveReport(
    id: ID,
  ): Promise<{ id: ID; engagementId: ID<'Engagement'> | null } | undefined> {
    const [row] = await this.db
      .select({
        id: periodicReports.id,
        engagementId: periodicReports.engagementId,
      })
      .from(periodicReports)
      .where(
        and(eq(periodicReports.id, id), isNull(periodicReports.deletedAt)),
      );
    return row;
  }

  async readMany(ids: readonly ID[]): Promise<Array<UnsecuredDto<Post>>> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select(this.columns)
      .from(posts)
      .where(
        and(inArray(posts.id, ids as Array<ID<'Post'>>), this.authFilter()),
      );
    return rows.map((row) => this.toDto(row));
  }

  async securedList({ filter, ...input }: PostListInput) {
    const conditions = [this.authFilter()];
    if (filter?.parentId) {
      conditions.push(eq(posts.parentId, filter.parentId));
    }
    if (filter?.types?.length) {
      conditions.push(inArray(posts.type, [...filter.types]));
    }
    const predicate = and(...conditions);
    const offset = (input.page - 1) * input.count;
    const [countRows, rows] = await Promise.all([
      this.db.select({ total: count() }).from(posts).where(predicate),
      this.db
        .select(this.columns)
        .from(posts)
        .where(predicate)
        .orderBy(
          ...resolveOrderBy(
            input,
            {
              createdAt: posts.createdAt,
              modifiedAt: posts.modifiedAt,
              type: posts.type,
              shareability: posts.shareability,
              body: posts.body,
            } satisfies SortMap<keyof Post>,
            posts.createdAt,
          ),
          asc(posts.id),
        )
        .limit(input.count)
        .offset(offset),
    ]);
    const total = countRows[0]?.total ?? 0;
    return {
      items: rows.map((row) => this.toDto(row)),
      total,
      hasMore: offset + rows.length < total,
    };
  }

  async getBaseNode(id: ID): Promise<BaseNode | undefined> {
    return await resolveResourceBaseNode(this.db, id);
  }

  async deleteNode(objectOrId: { id: ID } | ID): Promise<void> {
    const id = typeof objectOrId === 'string' ? objectOrId : objectOrId.id;
    await this.db.delete(posts).where(eq(posts.id, id as ID<'Post'>));
    // Hand-rolled delete (a hard delete, not the base's softDelete()), so it
    // has to invalidate itself — see the base class's doc comment on why
    // updateColumns()/softDelete() can't cover this for us.
    this.liveQueryStore.invalidate([this.resource, id]);
  }

  /** One row by id, without the auth filter — for the writer's own read-back. */
  private async hydrateOne(id: ID<'Post'>): Promise<UnsecuredDto<Post>> {
    const [row] = await this.db
      .select(this.columns)
      .from(posts)
      .where(eq(posts.id, id));
    if (!row) throw new NotFoundException();
    return this.toDto(row);
  }

  /**
   * A post is visible when its shareability isn't Membership, or when the
   * requester is an active member of the parent's project. Language and
   * Partner parents have no project to resolve against, so Membership posts on
   * those stay hidden — matching the old Neo4j member-path filter. Gated on
   * 'Membership' only; a (deprecated) 'ProjectTeam' value is treated as
   * unrestricted, as before.
   *
   * Engagement parents resolve one hop further, through
   * `engagements.project_id`. Without that hop a Membership post on an
   * engagement would compare an engagement id against
   * `project_members.project_id`, never match, and be invisible to everyone —
   * including the person who wrote it.
   */
  private authFilter(): SQL {
    const userId = this.identity.currentMaybe?.userId;
    if (!userId) {
      return sql`${posts.shareability} <> 'Membership'`;
    }
    const activeMemberOf = (projectId: SQL) => sql`exists (
      select 1 from ${projectMembers}
      where ${projectMembers.projectId} = ${projectId}
        and ${projectMembers.userId} = ${userId}
        and ${projectMembers.deletedAt} is null
        and ${projectMembers.inactiveAt} is null
    )`;
    return sql`(${posts.shareability} <> 'Membership'
      or ${activeMemberOf(sql`${posts.parentId}`)}
      or ${activeMemberOf(sql`(
        select ${engagements.projectId} from ${engagements}
        where ${engagements.id} = ${posts.parentId}
      )`)}
    )`;
  }
}
