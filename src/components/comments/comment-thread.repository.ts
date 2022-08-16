import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { ID, Session } from '../../common';
import { DtoRepository } from '../../core';
import {
  createNode,
  createRelationships,
  matchRequestingUser,
  paginate,
  requestingUser,
  sorting,
} from '../../core/database/query';
import {
  CommentThread,
  CommentThreadListInput,
  CreateCommentThread,
} from './dto';

@Injectable()
export class CommentThreadRepository extends DtoRepository(CommentThread) {
  async create(input: CreateCommentThread, session: Session) {
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

  async list({ filter, ...input }: CommentThreadListInput, session: Session) {
    const result = await this.db
      .query()
      .match(requestingUser(session))
      .match(node('node', 'CommentThread'))
      .apply(sorting(CommentThread, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
