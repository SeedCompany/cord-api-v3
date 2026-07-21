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
import { posts, projectMembers } from '~/core/drizzle/schema';
import { type BaseNode } from '~/core/neo4j/results';
import { type CreatePost, Post, type UpdatePost } from './dto';
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
      body: row.body,
      modifiedAt: DateTime.fromJSDate(row.modifiedAt),
      canDelete: true,
    };
    return dto as UnsecuredDto<Post>;
  }

  async create(input: CreatePost): Promise<{ dto: UnsecuredDto<Post> }> {
    const parentNode = await resolveResourceBaseNode(this.db, input.parent);
    if (!parentNode) {
      throw new NotFoundException('Resource does not exist', 'parent');
    }
    const id = await generateId<ID<'Post'>>();
    await this.db.insert(posts).values({
      id,
      parentId: input.parent,
      parentType: parentNode.labels[0]!,
      creatorId: this.identity.current.userId,
      type: input.type,
      shareability: input.shareability,
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
    await this.updateColumns(existing.id, {
      type: c.type,
      shareability: c.shareability,
      body: c.body,
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
  }

  /**
   * A post is visible when its shareability isn't Membership, or when the
   * requester is an active member of the (Project) parent. Only Project
   * parents have members, so Membership posts on Language/Partner are hidden —
   * matching the Neo4j member-path filter. Gated on 'Membership' only; a
   * (deprecated) 'ProjectTeam' value is treated as unrestricted, as in Neo4j.
   */
  private authFilter(): SQL {
    const userId = this.identity.currentMaybe?.userId;
    if (!userId) {
      return sql`${posts.shareability} <> 'Membership'`;
    }
    return sql`(${posts.shareability} <> 'Membership' or exists (
      select 1 from ${projectMembers}
      where ${projectMembers.projectId} = ${posts.parentId}
        and ${projectMembers.userId} = ${userId}
        and ${projectMembers.deletedAt} is null
    ))`;
  }
}
