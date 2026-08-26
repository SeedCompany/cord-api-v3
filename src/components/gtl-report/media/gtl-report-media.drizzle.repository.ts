import { Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { generateId, type ID, NotFoundException } from '~/common';
import { Identity } from '~/core/authentication';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import {
  engagements,
  fileNodes,
  gtlReportMedia,
  media,
  periodicReports,
  projects,
} from '~/core/drizzle/schema';
import { LiveQueryStore } from '~/core/live-query';
import { requesterScopeByProject } from '../../project/project-member/membership-scope';
import {
  GtlReportMedia,
  type UpdateGtlReportMedia,
  type UploadGtlReportMedia,
} from '../dto';

/**
 * Postgres-only, like the rest of the GTL domain — no splitDb, no Neo4j arm.
 *
 * Sensitivity and the requester's project scope come from the
 * report → engagement → project chain, the same walk
 * ProgressReportMediaDrizzleRepository makes; `secure()` needs both and neither
 * is on the media row.
 */
@Injectable()
export class GtlReportMediaDrizzleRepository {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly identity: Identity,
    private readonly liveQueryStore: LiveQueryStore,
  ) {}

  protected get db() {
    return this.drizzle.client;
  }

  async listForReport(reportId: ID<'GTLReport'>) {
    return await this.hydrate([eq(gtlReportMedia.reportId, reportId)]);
  }

  async readMany(ids: ReadonlyArray<ID<'GtlReportMedia'>>) {
    if (ids.length === 0) return [];
    return await this.hydrate([inArray(gtlReportMedia.id, ids as string[])]);
  }

  async readOne(id: ID<'GtlReportMedia'>) {
    const [row] = await this.readMany([id]);
    if (!row) {
      throw new NotFoundException('Could not find GTL report media');
    }
    return row;
  }

  async create(input: UploadGtlReportMedia, fileId: ID<'File'>) {
    const id = await generateId<ID<'GtlReportMedia'>>();
    await this.db.insert(gtlReportMedia).values({
      id,
      reportId: input.report,
      category: input.category ?? null,
      caption: input.caption ?? null,
      fileId,
      creatorId: this.identity.current.userId,
    });
    return id;
  }

  async update(input: UpdateGtlReportMedia) {
    await this.db
      .update(gtlReportMedia)
      .set({
        // `undefined` leaves the column alone; `null` clears it. Both are
        // meaningful here — a caption can be removed.
        category: input.category,
        caption: input.caption,
        modifiedAt: new Date(),
      })
      .where(eq(gtlReportMedia.id, input.id));
    this.liveQueryStore.invalidate([GtlReportMedia, input.id]);
    return await this.readOne(input.id);
  }

  async delete(id: ID<'GtlReportMedia'>) {
    this.liveQueryStore.invalidate([GtlReportMedia, id]);
    await this.db
      .update(gtlReportMedia)
      .set({ deletedAt: new Date() })
      .where(eq(gtlReportMedia.id, id));
  }

  private async hydrate(conditions: SQL[]) {
    const rows = await this.db
      .select({
        id: gtlReportMedia.id,
        createdAt: gtlReportMedia.createdAt,
        modifiedAt: gtlReportMedia.modifiedAt,
        reportId: gtlReportMedia.reportId,
        category: gtlReportMedia.category,
        caption: gtlReportMedia.caption,
        fileId: gtlReportMedia.fileId,
        creatorId: gtlReportMedia.creatorId,
        projectId: projects.id,
        sensitivity: projects.sensitivity,
        mediaId: media.id,
      })
      .from(gtlReportMedia)
      .innerJoin(
        periodicReports,
        eq(periodicReports.id, gtlReportMedia.reportId),
      )
      .innerJoin(engagements, eq(engagements.id, periodicReports.engagementId))
      .innerJoin(projects, eq(projects.id, engagements.projectId))
      .leftJoin(fileNodes, eq(fileNodes.id, gtlReportMedia.fileId))
      .leftJoin(media, eq(media.fileVersionId, fileNodes.latestVersionId))
      .where(
        and(
          ...conditions,
          isNull(gtlReportMedia.deletedAt),
          // The report, engagement and project all have to still be live —
          // neither engine cascades a soft delete downward, so without these a
          // removed project keeps serving its media. @see the same guard on
          // ProgressReportMediaDrizzleRepository.hydrate.
          isNull(periodicReports.deletedAt),
          isNull(engagements.deletedAt),
          isNull(projects.deletedAt),
        ),
      )
      .orderBy(asc(gtlReportMedia.createdAt), asc(gtlReportMedia.id));

    const scopeByProject = await requesterScopeByProject(
      this.db,
      this.identity.current.userId,
      rows.map((r) => r.projectId),
    );

    return rows.map((row) => ({
      id: row.id,
      createdAt: DateTime.fromJSDate(row.createdAt),
      modifiedAt: DateTime.fromJSDate(row.modifiedAt),
      report: { id: row.reportId },
      category: row.category,
      caption: row.caption,
      file: row.fileId,
      media: row.mediaId,
      creator: { id: row.creatorId },
      sensitivity: row.sensitivity,
      scope: scopeByProject.get(row.projectId) ?? [],
      canDelete: true,
    }));
  }
}
