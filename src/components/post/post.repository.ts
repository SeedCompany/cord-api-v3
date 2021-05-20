import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ID, Session } from '../../common';
import {
  createBaseNode,
  DatabaseService,
  matchRequestingUser,
  Property,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  matchPropList,
} from '../../core/database/query';
import { DbPropsOfDto, StandardReadResult } from '../../core/database/results';
import { Post, UpdatePost } from './dto';
import { PostListInput } from './dto/list-posts.dto';

@Injectable()
export class PostRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(
    parentId: string,
    postId: ID,
    secureProps: Property[],
    session: Session
  ) {
    const createPost = this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(createBaseNode(postId, ['Post'], secureProps))
      .return('node.id as id');

    await createPost.first();

    await this.db
      .query()
      .match([
        [node('baseNode', 'BaseNode', { id: parentId })],
        [node('post', 'Post', { id: postId })],
      ])
      .create([
        node('baseNode'),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('post'),
      ])
      .return('post.id as id')
      .first();
  }

  async checkParentIdValidity(parentId: string) {
    return await this.db
      .query()
      .match([
        node('baseNode', 'BaseNode', {
          id: parentId,
        }),
      ])
      .return('baseNode.id')
      .first();
  }

  async readOne(postId: ID, session: Session) {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'Post', { id: postId })])
      .apply(matchPropList)
      .return('node, propList')
      .asResult<StandardReadResult<DbPropsOfDto<Post>>>();

    return await query.first();
  }

  async checkDeletePermission(id: ID, session: Session) {
    return await this.db.checkDeletePermission(id, session);
  }

  async updateProperties(input: UpdatePost, object: Post) {
    await this.db.updateProperties({
      type: Post,
      object,
      changes: {
        body: input.body,
      },
    });
  }

  async deleteNode(node: Post) {
    await this.db.deleteNode(node);
  }

  securedList({ filter, ...input }: PostListInput) {
    const label = 'Post';
    // FIXME: we haven't implemented permissioning here yet

    return this.db
      .query()
      .match([
        // FIXME: Until the authorizationService.processNewBaseNode refactor is complete, commenting the two lines below out and
        // simply querying the Post nodes directly
        // requestingUser(session),
        // ...permissionsOfNode(label),
        node('node', label),

        ...(filter.parentId
          ? [
              relation('in', 'member'),
              node('baseNode', 'BaseNode', {
                id: filter.parentId,
              }),
            ]
          : []),
      ])
      .call(calculateTotalAndPaginateList(Post, input));
  }
}
