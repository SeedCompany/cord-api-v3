import { Injectable } from '@nestjs/common';
import { inArray, node, not, Query, relation } from 'cypher-query-builder';
import {
  generateId,
  ID,
  IdOf,
  InputException,
  NotFoundException,
  ServerException,
  Session,
} from '~/common';
import { DbTypeOf, DtoRepository } from '~/core/database';
import {
  ACTIVE,
  createNode,
  createRelationships,
  deleteBaseNode,
  filter,
  matchProjectScopedRoles,
  matchProjectSens,
  merge,
  oncePerProject,
  paginate,
  path,
  requestingUser,
  sorting,
  variable,
} from '~/core/database/query';
import { ProgressReport as Report } from '../dto';
import { projectFromProgressReportChild } from '../once-per-project-from-progress-report-child.db-query';
import {
  ProgressReportMediaListInput as ListArgs,
  ProgressReportMedia as ReportMedia,
  UpdateProgressReportMedia as UpdateMedia,
  UploadProgressReportMedia as UploadMedia,
} from './dto';

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
        relation('out', '', 'child', ACTIVE),
        node('node', this.resource.dbLabel),
      ])
      .apply(progressReportMediaFilters({ variants: args.variants }))
      .match(requestingUser(session))
      .apply(projectFromProgressReportChild)
      .apply(
        this.privileges.forUser(session).filterToReadable({
          wrapContext: oncePerProject,
        }),
      )
      .apply(
        sorting(ReportMedia, args, {
          variant: (q) => {
            const vo = q.params.addParam(
              ReportMedia.Variants.map((v) => v.key),
              'variantsOrder',
            );
            return q.return<{ sortValue: number }>(
              `apoc.coll.indexOf(${String(vo)}, node.variant) as sortValue`,
            );
          },
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
      .match(requestingUser(session))
      .apply(
        this.privileges.forUser(session).filterToReadable({
          wrapContext: oncePerProject,
        }),
      )
      .apply(this.hydrate(session))
      .map('dto')
      .run();
  }

  async readFeaturedOfReport(
    ids: ReadonlyArray<IdOf<Report>>,
    session: Session,
  ) {
    return await this.db
      .query()
      .matchNode('report', 'ProgressReport')
      .where({ 'report.id': inArray(ids) })
      .subQuery('report', (sub) =>
        sub
          .match([
            node('report'),
            relation('out', '', 'child', ACTIVE),
            node('node', this.resource.dbLabel, {
              variant: ReportMedia.Variants.at(-1)!.key,
            }),
          ])
          .return('node')
          .orderBy('node.createdAt', 'DESC')
          .raw('LIMIT 1'),
      )
      .apply(projectFromProgressReportChild)
      .match(requestingUser(session))
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
      .apply((q) => {
        // Create a new variant group if one isn't provided
        if (!input.variantGroup) {
          return q
            .createNode('variantGroup', 'VariantGroup', {
              id: newVariantGroupId,
            })
            .with('report, variantGroup');
        }
        return (
          q
            // Look up existing VariantGroup
            .matchNode('variantGroup', 'VariantGroup', {
              id: input.variantGroup,
            })
            // Block media creation if the variant group already has this variant
            .where(
              not(
                path([
                  node('variantGroup'),
                  relation('out', '', 'child', ACTIVE),
                  node({ variant: input.variant.key }),
                ]),
              ),
            )
        );
      })
      .apply(
        await createNode(this.resource, {
          baseNodeProps: {
            variant: input.variant.key,
            category: input.category,
          },
        }),
      )
      .apply(
        createRelationships(this.resource, 'out', {
          creator: ['User', session.userId],
        }),
      )
      .apply(
        createRelationships(this.resource, 'in', {
          child: variable('variantGroup'),
        }),
      )
      .apply(
        createRelationships(this.resource, 'in', {
          child: variable('report'),
        }),
      )
      .return<{ dto: Omit<DbTypeOf<ReportMedia>, 'media' | 'file'> }>(
        merge('node', {
          report: 'report.id',
          creator: 'creator { .id }',
        }).as('dto'),
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
        relation('out', '', 'child', ACTIVE),
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

  async deleteVariantGroupIfEmpty(id: string) {
    await this.db
      .query()
      .match(node('variantGroup', 'VariantGroup', { id }))
      .raw('where not exists((variantGroup)-[:child { active: true }]->())')
      .apply(deleteBaseNode('variantGroup'))
      .return('*')
      .executeAndLogStats();
  }

  protected hydrate(session: Session) {
    return (query: Query) =>
      query
        .apply(projectFromProgressReportChild)
        .apply(matchProjectSens())
        .apply(matchProjectScopedRoles({ session, outputVar: 'scope' }))
        .match([
          [
            node('node'),
            relation('in', '', 'child', ACTIVE),
            node('report', 'ProgressReport'),
          ],
          [
            node('node'),
            relation('in', '', 'child', ACTIVE),
            node('variantGroup', 'VariantGroup'),
          ],
          [
            node('node'),
            relation('out', '', 'fileNode', ACTIVE),
            node('file', 'File'),
          ],
          [
            node('node'),
            relation('out', '', 'creator', ACTIVE),
            node('creator', 'User'),
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
            creator: 'creator { .id }',
            sensitivity: 'sensitivity',
            scope: 'scope',
          }).as('dto'),
        );
  }
}

export const progressReportMediaFilters = filter.define<
  Pick<ListArgs, 'variants'>
>(() => ListArgs, {
  variants: ({ value }) => ({
    'node.variant': inArray(value.map((v) => v.key)),
  }),
});
