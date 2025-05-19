import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, type Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { type ID, type Session, type UnsecuredDto } from '~/common';
import { DtoRepository } from '~/core/database';
import { type ChangesOf } from '~/core/database/changes';
import {
  ACTIVE,
  createNode,
  createRelationships,
  currentUser,
  matchProps,
  merge,
  paginate,
  sorting,
  variable,
} from '~/core/database/query';
import { CommentThreadRepository } from './comment-thread.repository';
import {
  Comment,
  type CommentListInput,
  type CreateCommentInput,
  type UpdateCommentInput,
} from './dto';

@Injectable()
export class CommentRepository extends DtoRepository(Comment) {
  constructor(
    @Inject(forwardRef(() => CommentThreadRepository))
    readonly threads: CommentThreadRepository & {},
  ) {
    super();
  }

  async create(input: CreateCommentInput, session: Session) {
    const initialProps = {
      body: input.body,
      modifiedAt: DateTime.local(),
    };
    return await this.db
      .query()
      .subQuery(
        input.threadId
          ? (q) =>
              q
                .matchNode('thread', 'CommentThread', { id: input.threadId })
                .return('thread')
          : await this.threads.create(input.resourceId, session),
      )
      .apply(await createNode(Comment, { initialProps }))
      .apply(
        createRelationships(Comment, {
          in: { comment: variable('thread') },
          out: { creator: currentUser },
        }),
      )
      .return<{ id: ID; threadId: ID }>([
        'node.id as id',
        'thread.id as threadId',
      ])
      .first();
  }

  async update(
    existing: UnsecuredDto<Comment>,
    changes: ChangesOf<Comment, UpdateCommentInput>,
  ) {
    await this.updateProperties(existing, changes);
  }

  override hydrate() {
    return (query: Query) =>
      query
        .apply(matchProps())
        .match([
          node('node'),
          relation('in', '', 'comment', ACTIVE),
          node('thread', 'CommentThread'),
        ])
        .match([
          node('node'),
          relation('out', '', 'creator'),
          node('creator', 'User'),
        ])
        .return<{ dto: UnsecuredDto<Comment> }>(
          merge('props', { thread: 'thread.id', creator: 'creator.id' }).as(
            'dto',
          ),
        );
  }

  async list(threadId: ID, input: CommentListInput, session: Session) {
    const result = await this.db
      .query()
      .match([
        node('thread', 'CommentThread', { id: threadId }),
        relation('out', '', 'comment', ACTIVE),
        node('node', 'Comment'),
      ])
      .apply(sorting(Comment, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
