import { Injectable } from '@nestjs/common';
import { asc, count, eq, inArray } from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  generateId,
  type ID,
  NotFoundException,
  type UnsecuredDto,
} from '~/common';
import { Identity } from '~/core/authentication';
import {
  DrizzleService,
  resolveOrderBy,
  resolveResourceBaseNode,
} from '~/core/drizzle';
import { comments, commentThreads } from '~/core/drizzle/schema';
import { type BaseNode } from '~/core/neo4j/results';
import { type CommentThread, type CommentThreadListInput } from './dto';
import { mapCommentRow } from './map-comment-row';

type ThreadRow = typeof commentThreads.$inferSelect;
type CommentRow = typeof comments.$inferSelect;

@Injectable()
export class CommentThreadDrizzleRepository {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly identity: Identity,
  ) {}

  protected get db() {
    return this.drizzle.client;
  }

  async create(parent: ID): Promise<ID<'CommentThread'>> {
    const parentNode = await resolveResourceBaseNode(this.db, parent);
    if (!parentNode) {
      throw new NotFoundException('Resource does not exist', 'resource');
    }
    const id = await generateId<ID<'CommentThread'>>();
    await this.db.insert(commentThreads).values({
      id,
      parentId: parent,
      // The concrete typename (e.g. 'MomentumTranslationProject', 'User') —
      // enough for ResourceLoader.loadByBaseNode to find the loader.
      parentType: parentNode.labels[0]!,
      creatorId: this.identity.current.userId,
    });
    return id;
  }

  async readOne(id: ID): Promise<UnsecuredDto<CommentThread>> {
    const rows = await this.readMany([id]);
    if (rows.length === 0) {
      throw new NotFoundException();
    }
    return rows[0]!;
  }

  async readMany(
    ids: readonly ID[],
  ): Promise<Array<UnsecuredDto<CommentThread>>> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(commentThreads)
      .where(inArray(commentThreads.id, ids as Array<ID<'CommentThread'>>));
    return await this.hydrate(rows);
  }

  async list(parent: ID | undefined, input: CommentThreadListInput) {
    const predicate = parent ? eq(commentThreads.parentId, parent) : undefined;
    const offset = (input.page - 1) * input.count;
    const [countRows, rows] = await Promise.all([
      this.db.select({ total: count() }).from(commentThreads).where(predicate),
      this.db
        .select()
        .from(commentThreads)
        .where(predicate)
        .orderBy(
          ...resolveOrderBy(
            input,
            { createdAt: commentThreads.createdAt },
            commentThreads.createdAt,
          ),
          asc(commentThreads.id),
        )
        .limit(input.count)
        .offset(offset),
    ]);
    const total = countRows[0]?.total ?? 0;
    return {
      items: await this.hydrate(rows),
      total,
      hasMore: offset + rows.length < total,
    };
  }

  async count(parent: ID): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(commentThreads)
      .where(eq(commentThreads.parentId, parent));
    return row?.total ?? 0;
  }

  async getBaseNode(id: ID): Promise<BaseNode | undefined> {
    const [row] = await this.db
      .select({ createdAt: commentThreads.createdAt })
      .from(commentThreads)
      .where(eq(commentThreads.id, id as ID<'CommentThread'>))
      .limit(1);
    if (!row) return undefined;
    return {
      identity: id,
      labels: ['CommentThread', 'BaseNode'],
      properties: { id, createdAt: DateTime.fromJSDate(row.createdAt) },
    };
  }

  async deleteNode(objectOrId: { id: ID } | ID): Promise<void> {
    const id = typeof objectOrId === 'string' ? objectOrId : objectOrId.id;
    await this.db
      .delete(commentThreads)
      .where(eq(commentThreads.id, id as ID<'CommentThread'>));
  }

  private async hydrate(
    rows: ThreadRow[],
  ): Promise<Array<UnsecuredDto<CommentThread>>> {
    if (rows.length === 0) return [];
    const threadIds = rows.map((r) => r.id);
    const commentRows = await this.db
      .select()
      .from(comments)
      .where(inArray(comments.threadId, threadIds))
      .orderBy(asc(comments.createdAt), asc(comments.id));
    const byThread = new Map<string, CommentRow[]>();
    for (const c of commentRows) {
      const arr = byThread.get(c.threadId) ?? [];
      arr.push(c);
      byThread.set(c.threadId, arr);
    }
    return rows.map((row) => this.toDto(row, byThread.get(row.id) ?? []));
  }

  private toDto(
    row: ThreadRow,
    threadComments: CommentRow[],
  ): UnsecuredDto<CommentThread> {
    const first = threadComments[0];
    const latest = threadComments[threadComments.length - 1];
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
      creator: row.creatorId,
      firstComment: first ? mapCommentRow(first) : undefined,
      latestComment: latest ? mapCommentRow(latest) : undefined,
      canDelete: true,
    };
    return dto as UnsecuredDto<CommentThread>;
  }
}
