import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ID, Session } from '../../common';
import { DtoRepository } from '../../core';
import {
  ACTIVE,
  createNode,
  createRelationships,
  matchRequestingUser,
  paginate,
  requestingUser,
  sorting,
} from '../../core/database/query';
import { Comment, CommentListInput, CreateCommentInput } from './dto';

@Injectable()
export class CommentRepository extends DtoRepository(Comment) {
  async create(input: CreateCommentInput, session: Session) {
    const initialProps = {
      creator: session.userId,
      body: input.body,
      modifiedAt: DateTime.local(),
    };
    return await this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(await createNode(Comment, { initialProps }))
      .apply(
        createRelationships(Comment, 'in', {
          comment: ['BaseNode', input.threadId],
        })
      )
      .return<{ id: ID }>('node.id as id')
      .first();
  }

  async getThreadId(id: ID) {
    return await this.db
      .query()
      .match([
        node('node', 'Comment', { id }),
        relation('in', '', 'comment', ACTIVE),
        node('thread', 'CommentThread'),
      ])
      .return<{ threadId: ID }>('thread.id as threadId')
      .first();
  }

  async list(input: CommentListInput, session: Session) {
    const { threadId } = input.filter;
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
