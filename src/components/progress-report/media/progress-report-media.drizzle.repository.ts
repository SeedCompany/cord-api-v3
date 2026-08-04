import { Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  generateId,
  type ID,
  InputException,
  NotFoundException,
} from '~/common';
import { Identity } from '~/core/authentication';
import { type DbTypeOf } from '~/core/database';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { catchUniqueViolation } from '~/core/drizzle/errors';
import {
  engagements,
  fileNodes,
  media,
  periodicReports,
  progressReportMedia,
  projects,
} from '~/core/drizzle/schema';
import { LiveQueryStore } from '~/core/live-query';
import { requesterScopeByProject } from '../../project/project-member/membership-scope';
import { type ProgressReport as Report } from '../dto';
import {
  type ProgressReportMediaListInput as ListArgs,
  ProgressReportMedia as ReportMedia,
  type UpdateProgressReportMedia as UpdateMedia,
  type UploadProgressReportMedia as UploadMedia,
} from './dto';

type Row = DbTypeOf<ReportMedia>;

const variantOrder = new Map(
  ReportMedia.Variants.map((v, i) => [v.key, i] as const),
);

/**
 * Postgres/Drizzle implementation of ProgressReportMedia (Phase 7). One row per
 * (variantGroup, variant); `file_id` is a DefinedFile placeholder; the media
 * sidecar is reached via that file's latest FileVersion. Project sensitivity +
 * the requester's project-scoped roles (for `secure()`) come from the
 * report → engagement → project chain.
 *
 * migration-todo (cutover): drop alongside the Neo4j ProgressReportMediaRepository.
 * migration-todo: no row-level read filter — `secure()` handles field access and
 *   the only caller paths run as project members; add an applyReadFilter when a
 *   restricted-role e2e demands it.
 */
@Injectable()
export class ProgressReportMediaDrizzleRepository {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly identity: Identity,
    private readonly liveQueryStore: LiveQueryStore,
  ) {}

  protected get db() {
    return this.drizzle.client;
  }

  async listForReport(report: Report, args: ListArgs) {
    const variantKeys = args.variants?.map((v) => v.key);
    const all = await this.hydrate([
      eq(progressReportMedia.reportId, report.id),
      ...(variantKeys?.length
        ? [inArray(progressReportMedia.variant, variantKeys)]
        : []),
    ]);
    // Small per-report sets — sort + paginate in memory.
    const sorted = [...all].sort((a, b) => {
      if (args.sort === 'variant') {
        const cmp =
          (variantOrder.get(a.variant) ?? 0) -
          (variantOrder.get(b.variant) ?? 0);
        return args.order === 'DESC' ? -cmp : cmp;
      }
      const cmp = a.createdAt.toMillis() - b.createdAt.toMillis();
      return args.order === 'DESC' ? -cmp : cmp;
    });
    const offset = (args.page - 1) * args.count;
    const items = sorted.slice(offset, offset + args.count);
    return {
      items,
      total: sorted.length,
      hasMore: offset + items.length < sorted.length,
    };
  }

  async readMany(ids: readonly ID[]) {
    if (ids.length === 0) return [];
    return await this.hydrate([inArray(progressReportMedia.id, ids as ID[])]);
  }

  async readOne(id: ID): Promise<Row> {
    const [row] = await this.readMany([id]);
    if (!row) {
      throw new NotFoundException('Could not find ProgressReportMedia');
    }
    return row;
  }

  async readFeaturedOfReport(ids: ReadonlyArray<ID<Report>>) {
    if (ids.length === 0) return [];
    const publishedVariant = ReportMedia.Variants.at(-1)!.key;
    // Latest published-variant media per report.
    const featured = await this.db
      .selectDistinctOn([progressReportMedia.reportId], {
        id: progressReportMedia.id,
      })
      .from(progressReportMedia)
      .where(
        and(
          inArray(progressReportMedia.reportId, ids as Array<ID<Report>>),
          eq(progressReportMedia.variant, publishedVariant),
          isNull(progressReportMedia.deletedAt),
        ),
      )
      .orderBy(
        progressReportMedia.reportId,
        desc(progressReportMedia.createdAt),
      );
    return await this.readMany(featured.map((r) => r.id));
  }

  async create(
    input: UploadMedia,
    fileId: ID<'File'>,
  ): Promise<Omit<Row, 'media' | 'file'>> {
    let variantGroupId = input.variantGroup;
    if (variantGroupId) {
      const existing = await this.db
        .select({ variant: progressReportMedia.variant })
        .from(progressReportMedia)
        .where(
          and(
            eq(progressReportMedia.variantGroupId, variantGroupId),
            isNull(progressReportMedia.deletedAt),
          ),
        );
      if (existing.length === 0) {
        throw new NotFoundException(
          'Variant group does not exist',
          'variantGroup',
        );
      }
      if (existing.some((r) => r.variant === input.variant.key)) {
        throw new InputException(
          'Variant group already has this variant',
          'variant',
        );
      }
    } else {
      variantGroupId =
        await generateId<ID<'ProgressReportMediaVariantGroup'>>();
    }

    const id = await generateId<ID<'ProgressReportMedia'>>();
    const creatorId = this.identity.current.userId;
    await this.db
      .insert(progressReportMedia)
      .values({
        id,
        reportId: input.report,
        variant: input.variant.key,
        category: input.category ?? null,
        variantGroupId,
        fileId,
        creatorId,
      })
      // The `existing.some(...)` check above is a SELECT before this INSERT, so
      // two concurrent uploads to the same group+variant can both pass it. The
      // partial unique index is the fail-safe; map its violation to the SAME
      // error the check raises (DuplicateException extends InputException with
      // the same `field`), so a race is indistinguishable from the common case
      // rather than surfacing as a 500.
      .catch(
        catchUniqueViolation(
          'progress_report_media_group_variant_active_unique',
          'variant',
          'Variant group already has this variant',
        ),
      );
    return {
      id,
      createdAt: DateTime.now(),
      report: input.report,
      variant: input.variant.key,
      category: input.category ?? null,
      variantGroup: variantGroupId,
      creator: { id: creatorId },
      canDelete: true,
    } as unknown as Omit<Row, 'media' | 'file'>;
  }

  // No live-query invalidation here, deliberately: the Neo4j `update` is a raw
  // `setValues()` rather than `db.updateProperties`, so it does not announce
  // either. Matching it keeps this a pre-existing product gap on every engine
  // instead of a cutover regression.
  async update({ id, category }: UpdateMedia) {
    if (category === undefined) return;
    await this.db
      .update(progressReportMedia)
      .set({ category })
      .where(eq(progressReportMedia.id, id));
  }

  async deleteNode(objectOrId: { id: ID } | ID) {
    const id = typeof objectOrId === 'string' ? objectOrId : objectOrId.id;
    // Unlike `update` above, the Neo4j arm DOES announce here: it inherits
    // DtoRepository.deleteNode, which defaults `resource` to `this.resource` and
    // invalidates before deleting. This override bypasses that base entirely, so
    // it has to do it itself.
    this.liveQueryStore.invalidate([ReportMedia, id]);
    await this.db
      .update(progressReportMedia)
      .set({ deletedAt: new Date() })
      .where(eq(progressReportMedia.id, id));
  }

  // The VariantGroup is just a shared id under PG — it "exists" only while some
  // media references it, so emptiness cleanup is implicit. Kept for parity.
  async deleteVariantGroupIfEmpty(_id: string) {
    // no-op
  }

  private async hydrate(conditions: SQL[]): Promise<Row[]> {
    const rows = await this.db
      .select({
        id: progressReportMedia.id,
        createdAt: progressReportMedia.createdAt,
        reportId: progressReportMedia.reportId,
        variant: progressReportMedia.variant,
        category: progressReportMedia.category,
        variantGroupId: progressReportMedia.variantGroupId,
        fileId: progressReportMedia.fileId,
        creatorId: progressReportMedia.creatorId,
        projectId: projects.id,
        sensitivity: projects.sensitivity,
        mediaId: media.id,
      })
      .from(progressReportMedia)
      .innerJoin(
        periodicReports,
        eq(periodicReports.id, progressReportMedia.reportId),
      )
      .innerJoin(engagements, eq(engagements.id, periodicReports.engagementId))
      .innerJoin(projects, eq(projects.id, engagements.projectId))
      .leftJoin(fileNodes, eq(fileNodes.id, progressReportMedia.fileId))
      .leftJoin(media, eq(media.fileVersionId, fileNodes.latestVersionId))
      .where(
        and(
          ...conditions,
          isNull(progressReportMedia.deletedAt),
          // The report itself has to still be live. Before migration 0035 this
          // state could not arise — the foreign key has no ON DELETE action, so
          // it blocked the removal outright. Now the report soft-deletes and the
          // row stays, so media under a removed report kept resolving here.
          // Neo4j hides them: every one of its reads goes through
          // `projectFromProgressReportChild`, which requires the
          // `:ProgressReport` label, and soft delete relabels it.
          isNull(periodicReports.deletedAt),
        ),
      );

    const scopeByProject = await requesterScopeByProject(
      this.db,
      this.identity.current.userId,
      rows.map((r) => r.projectId),
    );

    return rows.map((row) => {
      const dto: unknown = {
        id: row.id,
        createdAt: DateTime.fromJSDate(row.createdAt),
        report: row.reportId,
        variant: row.variant,
        category: row.category,
        variantGroup: row.variantGroupId,
        file: row.fileId,
        media: row.mediaId,
        creator: { id: row.creatorId },
        sensitivity: row.sensitivity,
        scope: scopeByProject.get(row.projectId) ?? [],
        canDelete: true,
      };
      return dto as Row;
    });
  }
}
