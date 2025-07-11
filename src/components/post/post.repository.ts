import { Injectable } from '@nestjs/common';
import { inArray, node, type Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { type ID, type UnsecuredDto } from '~/common';
import { type DbTypeOf, DtoRepository } from '~/core/database';
import { type ChangesOf } from '~/core/database/changes';
import {
  ACTIVE,
  createNode,
  createRelationships,
  currentUser,
  matchProps,
  merge,
  paginate,
  sorting,
} from '~/core/database/query';
import { type CreatePost, Post, type UpdatePost } from './dto';
import { type PostListInput } from './dto/list-posts.dto';
import { PostShareability } from './dto/shareability.dto';

@Injectable()
export class PostRepository extends DtoRepository(Post) {
  async create(input: CreatePost) {
    const initialProps = {
      type: input.type,
      shareability: input.shareability,
      body: input.body,
      modifiedAt: DateTime.local(),
    };
    return await this.db
      .query()
      .apply(await createNode(Post, { initialProps }))
      .apply(
        createRelationships(Post, {
          in: {
            post: ['BaseNode', input.parentId],
          },
          out: {
            creator: currentUser,
          },
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

  async readMany(ids: readonly ID[]) {
    return await this.db
      .query()
      .matchNode('node', 'Post')
      .where({ 'node.id': inArray(ids) })
      .apply(this.filterAuthorized())
      .apply(this.hydrate())
      .map('dto')
      .run();
  }

  async securedList({ filter, ...input }: PostListInput) {
    const result = await this.db
      .query()
      .match([
        node('node', 'Post'),
        ...(filter?.parentId
          ? [
              relation('in', '', 'post', ACTIVE),
              node('', 'BaseNode', {
                id: filter.parentId,
              }),
            ]
          : []),
      ])
      .apply(this.filterAuthorized())
      .apply(sorting(Post, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!;
  }

  protected filterAuthorized() {
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
              (node)<-[:post]-(:BaseNode)-[:member]-(:BaseNode)-[:user]->(:User { id: $currentUser })
            )
          `,
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
        .match([
          node('node'),
          relation('out', '', 'creator', ACTIVE),
          node('creator', 'User'),
        ])
        .apply(matchProps())
        .return<{ dto: DbTypeOf<Post> }>(
          merge('props', {
            parent: 'parent',
            creator: 'creator { .id }',
          }).as('dto'),
        );
  }
}
