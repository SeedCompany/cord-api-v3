import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, type Query, relation } from 'cypher-query-builder';
import { type ID, type UnsecuredDto } from '~/common';
import { DtoRepository } from '~/core/database';
import {
  ACTIVE,
  createNode,
  createRelationships,
  currentUser,
  merge,
  paginate,
  sorting,
} from '~/core/database/query';
import { CommentRepository } from './comment.repository';
import { CommentThread, type CommentThreadListInput } from './dto';

@Injectable()
export class CommentThreadRepository extends DtoRepository(CommentThread) {
  constructor(
    @Inject(forwardRef(() => CommentRepository))
    private readonly comments: CommentRepository & {},
  ) {
    super();
  }

  async create(parent: ID) {
    const createThreadNode = await createNode(CommentThread, {});
    return (query: Query) =>
      query
        .apply(createThreadNode)
        .apply(
          createRelationships(CommentThread, {
            in: { commentThread: ['BaseNode', parent] },
            out: { creator: currentUser },
          }),
        )
        .return('node as thread');
  }

  override hydrate() {
    return (query: Query) =>
      query
        .match([
          node('node'),
          relation('in', undefined, 'commentThread'),
          node('parent', 'BaseNode'),
        ])
        .match([
          node('node'),
          relation('out', '', 'creator'),
          node('creator', 'User'),
        ])
        .subQuery('node', (sub) =>
          sub
            .with('node as thread')
            .match([
              node('thread'),
              relation('out', '', 'comment', ACTIVE),
              node('comment', 'Comment'),
            ])
            .with('comment')
            .orderBy('comment.createdAt')
            .with('collect(comment) as comments')
            .with('[comments[0], comments[-1]] as comments')
            .raw('unwind comments as node')
            .subQuery('node', this.comments.hydrate())
            .return('collect(dto) as comments'),
        )
        .return<{ dto: UnsecuredDto<CommentThread> }>(
          merge('node', {
            parent: 'parent',
            creator: 'creator.id',
            firstComment: 'comments[0]',
            latestComment: 'comments[-1]',
          }).as('dto'),
        );
  }

  async list(parent: ID | undefined, input: CommentThreadListInput) {
    const result = await this.db
      .query()
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

  async count(parent: ID) {
    const result = await this.db
      .query()
      .match([
        node('node', 'CommentThread'),
        relation('in', '', 'commentThread', ACTIVE),
        node('', 'BaseNode', { id: parent }),
      ])
      .return<{ count: number }>('count(node) as count')
      .map('count')
      .first();
    return result!;
  }
}
