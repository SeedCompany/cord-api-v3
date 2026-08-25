import { Injectable } from '@nestjs/common';
import { inArray, node, type Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { type ID, ServerException, type UnsecuredDto } from '~/common';
import { type DbTypeOf } from '~/core/database';
import { type ChangesOf } from '~/core/database/changes';
import { DtoRepository } from '~/core/neo4j';
import {
  ACTIVE,
  createNode,
  createRelationships,
  currentUser,
  matchProps,
  merge,
  paginate,
  sorting,
} from '~/core/neo4j/query';
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
            post: ['BaseNode', input.parent],
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
    // `report` is Postgres-only. It is a link to a periodic report, not a
    // property, so `updateProperties` cannot write it — and the features that
    // set it (partner quarterly reporting) are not being built against Neo4j.
    // Dropped here rather than throwing, so a mutation that only touches the
    // body still works on a Neo4j-backed deployment.
    const { report: _neo4jUnsupported, ...properties } =
      changes as typeof changes & {
        report?: unknown;
      };
    return await this.updateProperties(existing, properties);
  }

  /**
   * Postgres-only. Moderation was introduced for partner-submitted prayer,
   * which is not being built against Neo4j — but the injected repository is
   * typed as this class, so the method has to exist here.
   *
   * Throws rather than no-ops: silently not recording a moderator's decision
   * would leave a post looking reviewed when it never was, which is the one
   * outcome this feature exists to prevent.
   */
  async moderate(
    _ids: ReadonlyArray<ID<'Post'>>,
    _shareability: PostShareability,
  ): Promise<Array<UnsecuredDto<Post>>> {
    throw new ServerException('Post moderation requires the Postgres backend');
  }

  /** Postgres-only; see {@link moderate}. */
  async listAwaitingModeration(
    _parentIds: readonly ID[],
  ): Promise<Array<UnsecuredDto<Post>>> {
    throw new ServerException('Post moderation requires the Postgres backend');
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

  /**
   * `filter.type` is deliberately unimplemented here: only GTL reports narrow
   * posts by kind, and GTL exists on Postgres alone. If another caller ever
   * sets it, this path has to grow a `node.type` predicate.
   */
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
