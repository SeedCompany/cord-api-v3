import { Injectable } from '@nestjs/common';
import { inArray, node, or, Query, relation } from 'cypher-query-builder';
import { RequireAtLeastOne } from 'type-fest';
import { EnhancedResource, generateId, ID, ServerException } from '~/common';
import { CommonRepository } from '~/core';
import { ACTIVE, apoc, merge } from '~/core/database/query';
import { AnyMedia, MediaUserMetadata, resolveMedia } from './media.dto';

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

  async save(
    input: RequireAtLeastOne<Pick<AnyMedia, 'id' | 'file'>> & Partial<AnyMedia>,
  ) {
    const res = input.__typename
      ? EnhancedResource.of(resolveMedia(input as AnyMedia))
      : undefined;
    const tempId = await generateId();
    const query = this.db
      .query()
      .match([
        input.file ? [node('fv', 'FileVersion', { id: input.file })] : [],
        input.id ? [node('node', 'Media', { id: input.id })] : [],
      ])
      .apply((q) =>
        input.file
          ? q
              .merge([
                node('fv'),
                relation('out', '', 'media'),
                node('node', input.id ? undefined : 'Media'),
              ])
              .onCreate.set({
                values: { 'node.id': tempId },
                variables: { 'node.createdAt': 'datetime()' },
              })
          : q,
      )
      .setValues({ node: toDbShape(input) }, true)
      .with('node, fv')
      // Update the labels if typename is given, and maybe changed.
      .apply((q) =>
        res
          ? q.raw(
              'CALL apoc.create.setLabels(node, $newLabels) yield node as labelsAdded',
              { newLabels: res.dbLabels },
            )
          : q,
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
          .raw('LIMIT 1'),
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
      .with('node, fv')
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
        ...(input.__typename === 'Audio' || input.__typename === 'Video'
          ? { duration: input.duration }
          : // If not temporal, ensure duration gets cleared
            { duration: null }),
      }
    : {}),
});
