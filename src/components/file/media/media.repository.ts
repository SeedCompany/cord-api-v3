import { Injectable } from '@nestjs/common';
import { inArray, node, or, Query, relation } from 'cypher-query-builder';
import { Except, RequireAtLeastOne } from 'type-fest';
import { ID, ServerException } from '~/common';
import { CommonRepository } from '~/core';
import {
  ACTIVE,
  apoc,
  createNode,
  createRelationships,
  merge,
  variable,
} from '~/core/database/query';
import { AnyMedia, Media, MediaUserMetadata, resolveMedia } from './media.dto';

@Injectable()
export class MediaRepository extends CommonRepository {
  async readMany(
    input: RequireAtLeastOne<Record<'fvIds' | 'mediaIds', readonly ID[]>>,
  ) {
    return await this.db
      .query()
      .match([
        node('fv', 'FileVersion'),
        relation('out', '', 'media'),
        node('node', 'Media'),
      ])
      .where(
        or([
          ...(input.fvIds ? [{ 'fv.id': inArray(input.fvIds) }] : []),
          ...(input.mediaIds ? [{ 'node.id': inArray(input.mediaIds) }] : []),
        ]),
      )
      .apply(this.hydrate())
      .map('dto')
      .run();
  }

  protected hydrate() {
    return (query: Query) =>
      query.return<{ dto: AnyMedia }>(
        merge('node', {
          __typename: 'node.type',
          file: 'fv.id',
          dimensions: {
            width: 'node.width',
            height: 'node.height',
          },
        }).as('dto'),
      );
  }

  async create(input: Except<AnyMedia, 'id'>) {
    const query = this.db
      .query()
      .matchNode('fv', 'FileVersion', { id: input.file })
      .apply(
        await createNode(resolveMedia(input), {
          baseNodeProps: toDbShape(input),
        }),
      )
      .apply(
        createRelationships(Media, 'in', {
          media: variable('fv'),
        }),
      )
      // Grab the previous media node or null
      .subQuery('fv', (sub) =>
        sub
          .optionalMatch([
            node('fv'), // current is ignored since it's called out separately in this match
            relation('out', '', 'parent', ACTIVE),
            node('file', 'File'),
            relation('in', '', 'parent', ACTIVE),
            node('fvs', 'FileVersion'),
          ])
          .optionalMatch([
            node('fvs'),
            relation('out', '', 'media'),
            node('prevMedia', 'Media'),
          ])
          .return('prevMedia')
          .orderBy('fvs.createdAt', 'DESC')
          .limit(1),
      )
      // Use previous user metadata as defaults for new media
      .with('node, fv, prevMedia')
      .setVariables(
        {
          node: String(
            apoc.map.submap(
              apoc.map.merge('node', 'prevMedia'),
              MediaUserMetadata.Props.map((k) => `'${k}'`),
              [],
              false,
            ),
          ),
        },
        true,
      )
      .apply(this.hydrate());

    const result = await query.first();
    if (!result) {
      throw new ServerException('Failed to create media info');
    }
    return result.dto;
  }

  async update(
    input: RequireAtLeastOne<Pick<AnyMedia, 'id' | 'file'>> & Partial<AnyMedia>,
  ) {
    const query = this.db
      .query()
      .match([
        node('fv', 'FileVersion', input.file ? { id: input.file } : {}),
        relation('out', '', 'media'),
        node('node', 'Media', input.id ? { id: input.id } : {}),
      ])
      .setValues({ node: toDbShape(input) }, true)
      .apply(this.hydrate());

    const result = await query.first();
    if (!result) {
      throw new ServerException('Failed to save media info');
    }
    return result.dto;
  }
}

const toDbShape = (input: Partial<AnyMedia>) => ({
  type: input.__typename,
  altText: input.altText,
  caption: input.caption,
  mimeType: input.mimeType,
  ...(input.__typename
    ? {
        ...(input.__typename === 'Image' || input.__typename === 'Video'
          ? input.dimensions
          : // If not visual, ensure dimensions get cleared
            { width: null, height: null }),
        ...(input.__typename === 'Audio'
          ? { duration: input.duration }
          : // If not temporal, ensure duration gets cleared
            { duration: null }),
      }
    : {}),
});
