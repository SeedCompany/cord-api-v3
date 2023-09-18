import { Injectable } from '@nestjs/common';
import { inArray, node, or, Query, relation } from 'cypher-query-builder';
import { Except, RequireAtLeastOne } from 'type-fest';
import {
  EnhancedResource,
  generateId,
  ID,
  NotFoundException,
  ServerException,
} from '~/common';
import { CommonRepository } from '~/core';
import { ACTIVE, apoc, merge } from '~/core/database/query';
import { AnyMedia, MediaUserMetadata, resolveMedia } from './media.dto';

@Injectable()
export class MediaRepository extends CommonRepository {
  async readOne(input: RequireAtLeastOne<Pick<AnyMedia, 'id' | 'file'>>) {
    const [media] = await this.readMany(
      input.id ? { mediaIds: [input.id] } : { fvIds: [input.file!] },
    );
    if (!media) {
      throw new NotFoundException('Media not found');
    }
    return media;
  }

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
      query
        .subQuery('fv', (sub) =>
          sub
            .comment('Find root file node')
            .subQuery('fv', (sub2) =>
              sub2
                .raw('MATCH p=(fv)-[:parent*]->(node:FileNode)')
                .return('node as root')
                .orderBy('length(p)', 'DESC')
                .raw('LIMIT 1'),
            )
            .comment('Get resource holding root file node')
            .raw('MATCH (resource:BaseNode)-[rel]->(root)')
            .raw('WHERE not resource:FileNode')
            .return('[resource, type(rel)] as attachedTo')
            .raw('LIMIT 1'),
        )
        .return<{ dto: AnyMedia }>(
          merge('node', {
            __typename: 'node.type',
            file: 'fv.id',
            dimensions: {
              width: 'node.width',
              height: 'node.height',
            },
            attachedTo: 'attachedTo',
          }).as('dto'),
        );
  }

  async save(
    input: RequireAtLeastOne<Pick<AnyMedia, 'id' | 'file'>> &
      Partial<Except<AnyMedia, 'attachedTo'>>,
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
          : q.match([
              node('fv', 'FileVersion'),
              relation('out', '', 'media'),
              node('node'),
            ]),
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
    if (result) {
      return result.dto;
    }
    if (input.file) {
      const exists = await this.getBaseNode(input.file, 'FileVersion');
      if (!exists) {
        throw new NotFoundException(
          'Media could not be saved to nonexistent file',
        );
      }
    }
    if (input.id) {
      const exists = await this.getBaseNode(input.id, 'Media');
      if (!exists) {
        throw new NotFoundException('Media could not be found');
      }
    }
    throw new ServerException('Failed to save media info');
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
