import { Injectable } from '@nestjs/common';
import { asc, count, eq } from 'drizzle-orm';
import {
  generateId,
  type ID,
  type RichTextDocument,
  type UnsecuredDto,
} from '~/common';
import { Identity } from '~/core/authentication';
import { type ChangesOf } from '~/core/database/changes';
import {
  DrizzleDtoRepository,
  DrizzleService,
  resolveOrderBy,
  resolveResourceBaseNode,
} from '~/core/drizzle';
import { comments } from '~/core/drizzle/schema';
import { type BaseNode } from '~/core/neo4j/results';
import { CommentThreadDrizzleRepository } from './comment-thread.drizzle.repository';
import {
  Comment,
  type CommentListInput,
  type CreateComment,
  type UpdateComment,
} from './dto';
import { mapCommentRow } from './map-comment-row';

@Injectable()
export class CommentDrizzleRepository extends DrizzleDtoRepository<
  typeof comments,
  Comment
> {
  constructor(
    drizzle: DrizzleService,
    // Injected concretely (not via the CommentThreadRepository token): the
    // Drizzle thread repo has no back-reference to comments, so there's no
    // cycle — and routing both repos through splitDb would deadlock
    // moduleRef.create on the Neo4j repos' mutual forwardRef cycle.
    // `service.repo.threads.*` resolves to this under postgres.
    readonly threads: CommentThreadDrizzleRepository,
    private readonly identity: Identity,
  ) {
    super(drizzle, comments, Comment);
  }

  protected toDto(row: typeof comments.$inferSelect): UnsecuredDto<Comment> {
    return mapCommentRow(row);
  }

  async create(input: CreateComment): Promise<{ id: ID; threadId: ID }> {
    const threadId =
      input.thread ?? (await this.threads.create(input.resource));
    const id = await generateId<ID<'Comment'>>();
    await this.db.insert(comments).values({
      id,
      threadId: threadId,
      creatorId: this.identity.current.userId,
      body: input.body,
    });
    return { id, threadId };
  }

  async update(
    existing: UnsecuredDto<Comment>,
    changes: ChangesOf<Comment, UpdateComment>,
  ): Promise<void> {
    // Mirrors the Neo4j repo: only writes changed scalar props. modifiedAt is
    // not part of UpdateComment, so (as in Neo4j) it isn't bumped on edit.
    await this.updateColumns(existing.id, {
      body: (changes as { body?: RichTextDocument }).body,
    });
  }

  /**
   * Resolve the commentable PARENT id to a BaseNode (loadCommentable calls
   * this with a parent resource id, not a comment id). Probes the migrated
   * commentable tables.
   */
  async getBaseNode(id: ID): Promise<BaseNode | undefined> {
    return await resolveResourceBaseNode(this.db, id);
  }

  async deleteNode(objectOrId: { id: ID } | ID): Promise<void> {
    const id = typeof objectOrId === 'string' ? objectOrId : objectOrId.id;
    await this.db.delete(comments).where(eq(comments.id, id as ID<'Comment'>));
    // Hand-rolled delete (a hard delete, not the base's softDelete()), so it
    // has to invalidate itself — see the base class's doc comment on why
    // updateColumns()/softDelete() can't cover this for us.
    this.liveQueryStore.invalidate([this.resource, id]);
  }

  async list(threadId: ID, input: CommentListInput) {
    const predicate = eq(comments.threadId, threadId as ID<'CommentThread'>);
    const offset = (input.page - 1) * input.count;
    const [countRows, rows] = await Promise.all([
      this.db.select({ total: count() }).from(comments).where(predicate),
      this.db
        .select()
        .from(comments)
        .where(predicate)
        .orderBy(
          ...resolveOrderBy(
            input,
            { createdAt: comments.createdAt },
            comments.createdAt,
          ),
          asc(comments.id),
        )
        .limit(input.count)
        .offset(offset),
    ]);
    const total = countRows[0]?.total ?? 0;
    return {
      items: rows.map((r) => this.toDto(r)),
      total,
      hasMore: offset + rows.length < total,
    };
  }
}
