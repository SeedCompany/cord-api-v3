import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ID, Session } from '../../common';
import { DtoRepository } from '../../core';
import {
  ACTIVE,
  createNode,
  createRelationships,
  matchProps,
  matchRequestingUser,
  paginate,
  sorting,
} from '../../core/database/query';
import { CreatePost, Post } from './dto';
import { PostListInput } from './dto/list-posts.dto';
import { PostShareability } from './dto/shareability.dto';

@Injectable()
export class PostRepository extends DtoRepository(Post) {
  async create(input: CreatePost, session: Session) {
    const initialProps = {
      creator: session.userId,
      type: input.type,
      shareability: input.shareability,
      body: input.body,
      modifiedAt: DateTime.local(),
    };
    return await this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(await createNode(Post, { initialProps }))
      .apply(
        createRelationships(Post, 'in', {
          post: ['BaseNode', input.parentId],
        }),
      )
      .apply(this.hydrate())
      .first();
  }

  async securedList({ filter, ...input }: PostListInput, session: Session) {
    const result = await this.db
      .query()
      .match([
        node('node', 'Post'),
        ...(filter.parentId
          ? [
              relation('in', '', 'post', ACTIVE),
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
              NOT props.shareability = '${PostShareability.Membership}'
            ) OR (
              props.shareability = '${PostShareability.Membership}'
              AND
              (node)<-[:post]-(:BaseNode)-[:member]-(:BaseNode)-[:user]->(:User { id: $requestingUser })
            )
          `,
        { requestingUser: session.userId },
      )
      .apply(sorting(Post, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!;
  }
}
