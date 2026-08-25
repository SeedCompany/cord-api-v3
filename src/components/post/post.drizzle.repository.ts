import { Injectable } from '@nestjs/common';
import { and, asc, count, eq, inArray, type SQL, sql } from 'drizzle-orm';
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
import { engagements, posts, projectMembers } from '~/core/drizzle/schema';
import { type BaseNode } from '~/core/neo4j/results';
import { type CreatePost, needsModeration, Post, type UpdatePost } from './dto';
import { type PostListInput } from './dto/list-posts.dto';

@Injectable()
export class PostDrizzleRepository extends DrizzleDtoRepository<
  typeof posts,
  Post
> {
  constructor(
    drizzle: DrizzleService,
    private readonly identity: Identity,
  ) {
    super(drizzle, posts, Post);
  }

  protected toDto(row: typeof posts.$inferSelect): UnsecuredDto<Post> {
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
      report: row.reportId ? { id: row.reportId } : null,
      respondsTo: row.respondsToId ? { id: row.respondsToId } : null,
      body: row.body,
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
      respondsToId: input.respondsTo ?? null,
      body: input.body,
    });
    // Hydrated without the auth filter — mirrors the Neo4j create path, which
    // returns the post directly to its creator.
    const [row] = await this.db.select().from(posts).where(eq(posts.id, id));
    return { dto: this.toDto(row!) };
  }

  async update(
    existing: UnsecuredDto<Post>,
    changes: ChangesOf<Post, UpdatePost>,
  ): Promise<UnsecuredDto<Post>> {
    const c = changes as Partial<typeof posts.$inferInsert>;
    // Editing the requested reach upward invalidates any prior clearance —
    // otherwise a post approved at Internal could be edited to External and
    // keep the old approval, which is the one way this model could leak.
    const reopensModeration =
      c.shareability !== undefined && needsModeration(c.shareability);
    await this.updateColumns(existing.id, {
      type: c.type,
      shareability: c.shareability,
      body: c.body,
      // `report` is explicitly nullable: passing null detaches from the report
      // and leaves the post on its engagement. `undefined` means "don't touch".
      ...('report' in changes
        ? { reportId: (changes as { report?: ID | null }).report ?? null }
        : {}),
      ...(reopensModeration
        ? { approvedShareability: null, approvedById: null, approvedAt: null }
        : {}),
    });
    const [row] = await this.db
      .select()
      .from(posts)
      .where(eq(posts.id, existing.id));
    if (!row) throw new NotFoundException();
    return this.toDto(row);
  }

  async readMany(ids: readonly ID[]): Promise<Array<UnsecuredDto<Post>>> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
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
        .select()
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

  /**
   * A post is visible when its shareability isn't Membership, or when the
   * requester is an active member of the parent's project. Language and Partner
   * parents have no project to resolve against, so Membership posts on those
   * stay hidden — matching the Neo4j member-path filter. Gated on 'Membership'
   * only; a (deprecated) 'ProjectTeam' value is treated as unrestricted, as in
   * Neo4j.
   *
   * Engagement parents resolve one hop further, through `engagements.project_id`.
   * Without that hop a Membership post on an engagement would compare an
   * engagement id against `project_members.project_id`, never match, and become
   * invisible to everyone — including the person who wrote it.
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
