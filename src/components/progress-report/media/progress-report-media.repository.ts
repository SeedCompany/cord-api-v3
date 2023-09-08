import { Injectable } from '@nestjs/common';
import { inArray, node, not, Query, relation } from 'cypher-query-builder';
import {
  generateId,
  ID,
  InputException,
  NotFoundException,
  ServerException,
  Session,
} from '~/common';
import { DbTypeOf, DtoRepository } from '~/core';
import {
  ACTIVE,
  apoc,
  createNode,
  createRelationships,
  matchProjectScopedRoles,
  matchProjectSens,
  merge,
  oncePerProject,
  paginate,
  path,
  variable,
} from '~/core/database/query';
import { ProgressReport as Report } from '../dto';
import { projectFromProgressReportChild } from '../once-per-project-from-progress-report-child.db-query';
import {
  ProgressReportMediaListArgs as ListArgs,
  ProgressReportMedia as ReportMedia,
  UpdateProgressReportMedia as UpdateMedia,
  UploadProgressReportMedia as UploadMedia,
} from './media.dto';

@Injectable()
export class ProgressReportMediaRepository extends DtoRepository<
  typeof ReportMedia,
  [Session]
>(ReportMedia) {
  async listForReport(report: Report, args: ListArgs, session: Session) {
    const query = this.db
      .query()
      .match([
        node('report', 'ProgressReport', { id: report.id }),
        relation('out', '', 'media', ACTIVE),
        node('node', this.resource.dbLabel),
      ])
      .apply(projectFromProgressReportChild)
      .apply(
        this.privileges.forUser(session).filterToReadable({
          wrapContext: oncePerProject,
        }),
      )
      .apply(paginate(args, this.hydrate(session)));
    return (await query.first())!;
  }

  async readMany(ids: readonly ID[], session: Session) {
    return await this.db
      .query()
      .matchNode('node', this.resource.dbLabel)
      .where({ 'node.id': inArray(ids) })
      .apply(projectFromProgressReportChild)
      .apply(
        this.privileges.forUser(session).filterToReadable({
          wrapContext: oncePerProject,
        }),
      )
      .apply(this.hydrate(session))
      .map('dto')
      .run();
  }

  async create(input: UploadMedia, session: Session) {
    const newVariantGroupId = await generateId();
    const query = this.db
      .query()
      .matchNode('report', 'ProgressReport', { id: input.reportId })
      [
        // Only create a new variant group if one isn't provided
        // If one is given, it must already exist,
        // which is why we aren't using merge.
        input.variantGroup ? 'match' : 'create'
      ](
        node('variantGroup', 'VariantGroup', {
          id: input.variantGroup ?? newVariantGroupId,
        }),
      )
      // Block creation if the variant group already has this variant
      .where(
        not(
          path([
            node('variantGroup'),
            relation('out', '', 'variant', ACTIVE),
            node({ variant: input.variant.key }),
          ]),
        ),
      )
      .apply(
        await createNode(this.resource, {
          baseNodeProps: {
            variant: input.variant.key,
            category: input.category,
            creator: session.userId,
          },
        }),
      )
      .apply(
        createRelationships(this.resource, {
          in: {
            variant: variable('variantGroup'),
            media: variable('report'),
          },
        }),
      )
      .return<{ dto: Omit<DbTypeOf<ReportMedia>, 'media' | 'file'> }>(
        apoc.convert.toMap('node').as('dto'),
      );
    const results = await query.first();
    if (results) {
      return results.dto;
    }
    if (input.variantGroup) {
      const vg = await this.getBaseNode(input.variantGroup, 'VariantGroup');
      if (!vg) {
        throw new NotFoundException(
          'Variant group does not exist',
          'variantGroup',
        );
      }
    }

    const variantAlreadyExists = await this.db
      .query()
      .match([
        node('vg', 'VariantGroup'),
        relation('out', '', 'variant', ACTIVE),
        node({ variant: input.variant.key }),
      ])
      .return('vg')
      .first();
    if (variantAlreadyExists) {
      throw new InputException(
        'Variant group already has this variant',
        'variant',
      );
    }

    throw new ServerException('Failed to create report media');
  }

  async update({ id, category }: UpdateMedia) {
    await this.db
      .query()
      .matchNode('node', this.resource.dbLabel, { id })
      .setValues({ node: { category } }, true)
      .run();
  }

  async isVariantGroupEmpty(id: string) {
    const hasVariant = await this.db
      .query()
      .match([
        node('variantGroup', 'VariantGroup', { id }),
        relation('out', '', 'variant', ACTIVE),
        node('variant'),
      ])
      .return('variant')
      .first();
    return !hasVariant;
  }

  protected hydrate(session: Session) {
    return (query: Query) =>
      query
        .apply(matchProjectSens())
        .apply(matchProjectScopedRoles({ session, outputVar: 'scope' }))
        .match([
          [
            node('node'),
            relation('in', '', 'media', ACTIVE),
            node('report', 'ProgressReport'),
          ],
          [
            node('node'),
            relation('in', '', 'variant', ACTIVE),
            node('variantGroup', 'VariantGroup'),
          ],
          [
            node('node'),
            relation('out', '', 'fileNode', ACTIVE),
            node('file', 'File'),
          ],
        ])
        .subQuery('file', (sub) =>
          sub
            .match([
              node('file', 'FileNode'),
              relation('in', '', 'parent', ACTIVE),
              node('version', 'FileVersion'),
              relation('out', '', 'media'),
              node('media', 'Media'),
            ])
            .return('media')
            .orderBy('version.createdAt', 'DESC')
            .raw('LIMIT 1'),
        )
        .return<{ dto: DbTypeOf<ReportMedia> }>(
          merge('node', {
            report: 'report.id',
            variantGroup: 'variantGroup.id',
            file: 'file.id',
            media: 'media.id',
            sensitivity: 'sensitivity',
            scope: 'scope',
          }).as('dto'),
        );
  }
}
