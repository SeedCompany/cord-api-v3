import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { ID, Session, UnsecuredDto } from '../../common';
import { DtoRepository } from '../../core';
import {
  ACTIVE,
  createNode,
  createRelationships,
  matchRequestingUser,
  merge,
  paginate,
  requestingUser,
  sorting,
} from '../../core/database/query';
import {
  CommentThread,
  CommentThreadListInput,
  CreateCommentThreadInput,
} from './dto';

@Injectable()
export class CommentThreadRepository extends DtoRepository(CommentThread) {
  async create(input: CreateCommentThreadInput, session: Session) {
    return await this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(await createNode(CommentThread, {}))
      .apply(
        createRelationships(CommentThread, 'in', {
          commentThread: ['BaseNode', input.parentId],
        })
      )
      .return<{ id: ID }>('node.id as id')
      .first();
  }

  protected hydrate() {
    return (query: Query) =>
      query
        .match([
          node('node'),
          relation('in', undefined, 'commentThread'),
          node('parent', 'BaseNode'),
        ])
        .return<{ dto: UnsecuredDto<CommentThread> }>(
          merge('node', {
            parent: 'parent',
          }).as('dto')
        );
  }

  async list({ filter, ...input }: CommentThreadListInput, session: Session) {
    const result = await this.db
      .query()
      .match(requestingUser(session))
      .match([
        node('node', 'CommentThread'),
        ...(filter.parentId
          ? [
              relation('in', '', 'commentThread', ACTIVE),
              node('', 'BaseNode', { id: filter.parentId }),
            ]
          : []),
      ])
      .apply(sorting(CommentThread, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
