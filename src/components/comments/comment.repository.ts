import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ID, Session, UnsecuredDto } from '../../common';
import { DatabaseService, DtoRepository } from '../../core';
import {
  ACTIVE,
  createNode,
  createRelationships,
  matchProps,
  matchRequestingUser,
  merge,
  paginate,
  requestingUser,
  sorting,
  variable,
} from '../../core/database/query';
import { CommentThreadRepository } from './comment-thread.repository';
import { Comment, CommentListInput, CreateCommentInput } from './dto';

@Injectable()
export class CommentRepository extends DtoRepository(Comment) {
  constructor(readonly threads: CommentThreadRepository, db: DatabaseService) {
    super(db);
  }

  async create(input: CreateCommentInput, session: Session) {
    const initialProps = {
      creator: session.userId,
      body: input.body,
      modifiedAt: DateTime.local(),
    };
    return await this.db
      .query()
      .apply(matchRequestingUser(session))
      .subQuery(
        input.threadId
          ? (q) =>
              q
                .matchNode('thread', 'CommentThread', { id: input.threadId })
                .return('thread')
          : await this.threads.create(input.resourceId)
      )
      .apply(await createNode(Comment, { initialProps }))
      .apply(
        createRelationships(Comment, 'in', {
          comment: variable('thread'),
        })
      )
      .return<{ id: ID; threadId: ID }>([
        'node.id as id',
        'thread.id as threadId',
      ])
      .first();
  }

  protected hydrate() {
    return (query: Query) =>
      query
        .apply(matchProps())
        .match([
          node('node'),
          relation('in', '', 'comment', ACTIVE),
          node('thread', 'CommentThread'),
        ])
        .return<{ dto: UnsecuredDto<Comment> }>(
          merge('props', { thread: 'thread.id' }).as('dto')
        );
  }

  async list(threadId: ID, input: CommentListInput, session: Session) {
    const result = await this.db
      .query()
      .match(requestingUser(session))
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
