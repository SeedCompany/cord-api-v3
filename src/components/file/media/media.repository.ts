import { Injectable } from '@nestjs/common';
import { inArray, node, or, Query, relation } from 'cypher-query-builder';
import { Except, RequireAtLeastOne } from 'type-fest';
import { ID, ServerException } from '~/common';
import { CommonRepository } from '~/core';
import { createNode, createRelationships, merge } from '~/core/database/query';
import { AnyMedia, Media, resolveMedia } from './media.dto';

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
      .apply(
        await createNode(resolveMedia(input), {
          baseNodeProps: toDbShape(input),
        }),
      )
      .apply(
        createRelationships(Media, 'in', {
          media: ['FileVersion', input.file],
        }),
      )
      .return<{ id: ID }>('node.id as id');

    const result = await query.first();
    if (!result) {
      throw new ServerException('Failed to create media info');
    }
    return result;
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
      .return<{ id: ID }>('node.id as id');

    const result = await query.first();
    if (!result) {
      throw new ServerException('Failed to save media info');
    }
    return result;
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
