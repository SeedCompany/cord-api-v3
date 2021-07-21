import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ID, NotFoundException, Session, UnsecuredDto } from '../../common';
import {
  createBaseNode,
  DtoRepository,
  matchRequestingUser,
  Property,
} from '../../core';
import { matchProps, paginate, sorting } from '../../core/database/query';
import { Post } from './dto';
import { PostListInput } from './dto/list-posts.dto';
import { PostShareability } from './dto/shareability.dto';

@Injectable()
export class PostRepository extends DtoRepository(Post) {
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
        relation('out', '', 'post', {
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

  async readOne(postId: ID): Promise<UnsecuredDto<Post>> {
    const query = this.db
      .query()
      .match([node('node', 'Post', { id: postId })])
      .apply(this.hydrate());

    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find post', 'post.id');
    }
    return result.dto;
  }

  async securedList({ filter, ...input }: PostListInput, session: Session) {
    const result = await this.db
      .query()
      .match([
        node('node', 'Post'),
        ...(filter.parentId
          ? [
              relation('in', '', 'post', { active: true }),
              node('', 'BaseNode', {
                id: filter.parentId,
              }),
            ]
          : []),
      ])
      .apply(matchProps())
      .with('node, props') // needed directly before where clause
      // Only match posts whose shareability is ProjectTeam if the current user
      // is a member of the parent object
      .raw(
        // Parentheses for readability only, neo4j doesn't require them
        `
            WHERE (
              NOT props.shareability = '${PostShareability.ProjectTeam}'
            ) OR (
              props.shareability = '${PostShareability.ProjectTeam}'
              AND
              (node)<-[:post]-(:BaseNode)-[:member]-(:BaseNode)-[:user]->(:User { id: $requestingUserId })
            )
          `,
        { requestingUserId: session.userId }
      )
      .apply(sorting(Post, input))
      .apply(paginate(input))
      .first();
    return result!;
  }
}
