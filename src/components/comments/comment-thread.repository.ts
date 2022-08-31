import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { ID, Session, UnsecuredDto } from '../../common';
import { DtoRepository } from '../../core';
import {
  ACTIVE,
  createNode,
  createRelationships,
  merge,
  paginate,
  requestingUser,
  sorting,
} from '../../core/database/query';
import { CommentThread, CommentThreadListInput } from './dto';

@Injectable()
export class CommentThreadRepository extends DtoRepository(CommentThread) {
  async create(parent: ID) {
    const createThreadNode = await createNode(CommentThread, {});
    return (query: Query) =>
      query
        .apply(createThreadNode)
        .apply(
          createRelationships(CommentThread, 'in', {
            commentThread: ['BaseNode', parent],
          })
        )
        .return('node as thread');
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

  async list(
    parent: ID | undefined,
    input: CommentThreadListInput,
    session: Session
  ) {
    const result = await this.db
      .query()
      .match(requestingUser(session))
      .match([
        node('node', 'CommentThread'),
        ...(parent
          ? [
              relation('in', '', 'commentThread', ACTIVE),
              node('', 'BaseNode', { id: parent }),
            ]
          : []),
      ])
      .apply(sorting(CommentThread, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
