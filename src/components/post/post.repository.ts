import { Injectable } from '@nestjs/common';
import { inArray, node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ID, Session, UnsecuredDto } from '~/common';
import { DbTypeOf, DtoRepository } from '~/core/database';
import { ChangesOf } from '~/core/database/changes';
import {
  ACTIVE,
  createNode,
  createRelationships,
  matchProps,
  matchRequestingUser,
  merge,
  paginate,
  sorting,
} from '~/core/database/query';
import { CreatePost, Post, UpdatePost } from './dto';
import { PostListInput } from './dto/list-posts.dto';
import { PostShareability } from './dto/shareability.dto';

@Injectable()
export class PostRepository extends DtoRepository<typeof Post, [Session] | []>(
  Post,
) {
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

  async update(
    existing: UnsecuredDto<Post>,
    changes: ChangesOf<Post, UpdatePost>,
  ) {
    return await this.updateProperties(existing, changes);
  }

  async readMany(ids: readonly ID[], session: Session) {
    return await this.db
      .query()
      .matchNode('node', 'Post')
      .where({ 'node.id': inArray(ids) })
      .apply(this.filterAuthorized(session))
      .apply(this.hydrate())
      .map('dto')
      .run();
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
      .apply(this.filterAuthorized(session))
      .apply(sorting(Post, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!;
  }

  protected filterAuthorized(session: Session) {
    return (query: Query) =>
      query
        .with('node')
        .match([
          node('node'),
          relation('out', '', 'shareability', ACTIVE),
          node('shareability', 'Property'),
        ])
        // Only match posts whose shareability is ProjectTeam
        // if the current user is a member of the parent object
        .raw(
          `
            WHERE (
              NOT shareability.value = '${PostShareability.Membership}'
            ) OR (
              shareability.value = '${PostShareability.Membership}'
              AND
              (node)<-[:post]-(:BaseNode)-[:member]-(:BaseNode)-[:user]->(:User { id: $requestingUser })
            )
          `,
          { requestingUser: session.userId },
        );
  }

  protected hydrate() {
    return (query: Query) =>
      query
        .match([
          node('node'),
          relation('in', '', 'post', ACTIVE),
          node('parent', 'BaseNode'),
        ])
        .apply(matchProps())
        .return<{ dto: DbTypeOf<Post> }>(
          merge('props', {
            parent: 'parent',
          }).as('dto'),
        );
  }
}
