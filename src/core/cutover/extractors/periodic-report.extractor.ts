import { type ID } from '~/common';
import {
  engagements,
  periodicReports,
  progressReportStatusEnum,
  projects,
  reportTypeEnum,
} from '~/core/drizzle/schema';
import { type PeriodicReport } from '../../../components/periodic-report/dto';
import { PeriodicReportRepository } from '../../../components/periodic-report/periodic-report.repository';
import {
  bulkInsert,
  cypher,
  dateStr,
  liveTargetIds,
  one,
  readAllViaRepo,
  sanitizeEnum,
  tsReq,
} from '../cutover.helpers';
import { type Extractor } from '../cutover.types';

/**
 * PeriodicReport — one table over FinancialReport / NarrativeReport /
 * ProgressReport, which in Neo4j are three labels sharing the `:PeriodicReport`
 * one (2450 locally: 92 + 396 + 1962).
 *
 * Two shape CHECKs decide every drop here, and neither offers a null-and-carry-on
 * option:
 *
 *   periodic_reports_parent_shape_chk:
 *     Financial | Narrative ⟹ project_id NOT NULL AND engagement_id IS NULL
 *     Progress              ⟹ engagement_id NOT NULL AND project_id IS NULL
 *   periodic_reports_status_shape_chk:
 *     (type = 'Progress') = (status IS NOT NULL)
 *
 * Ids are NOT generated — they are sha256(parent:type:start:end) in both engines
 * (deterministicReportId), so preserving them is what keeps a re-sync idempotent
 * rather than duplicating every interval. Two reports can only collide on the PK
 * if they share all four dimensions, which is the intended dedup.
 *
 * `report_file_id` / `narrative_file_id` ARE populated, unlike the other
 * deferred-FK file columns in this harness: they are plain text with no FK (the
 * S4 class), and the ids carried here are the same File node ids the File wave
 * will insert. Nulling them would need a whole backfill pass later for nothing.
 * Until File runs they simply point at rows that do not exist yet, which reads as
 * "no file uploaded" — see hasUploadedFileVersion in the drizzle repo.
 *
 * `periodic_reports` has NO deleted_at: deletion is real. So there is no
 * soft-deleted state to carry over, and a report whose parent was soft-deleted in
 * Neo4j has nowhere to land — see the parent note below.
 */
export const periodicReportExtractor: Extractor = {
  name: 'periodic-report',
  targetTables: ['periodic_reports'],
  dependsOn: ['project', 'engagement'],
  async run(ctx) {
    const dtos = await readAllViaRepo<PeriodicReport>(
      ctx,
      'PeriodicReport',
      PeriodicReportRepository,
    );

    // Parent id + kind by raw Cypher rather than off the hydrated DTO, whose
    // `parent` is a raw Neo4j node rather than a LinkTo. Matching `parent:BaseNode`
    // also excludes reports hanging off a SOFT-DELETED parent (Neo4j relabels to
    // `Deleted_BaseNode`) — 67 progress reports under deleted engagements locally.
    // That is the same set the repo's hydrate drops, so the two agree by
    // construction and the readMany guard already reports the count.
    const parents = new Map<string, { id: ID; isEngagement: boolean }>();
    const parentRows = await cypher<{
      id: ID;
      parentId: ID;
      isEngagement: boolean;
    }>(
      ctx,
      `MATCH (parent:BaseNode)-[:report { active: true }]->(n:PeriodicReport)
       RETURN n.id AS id, parent.id AS parentId, parent:Engagement AS isEngagement`,
    );
    for (const row of parentRows) {
      parents.set(row.id, { id: row.parentId, isEngagement: row.isEngagement });
    }

    const landedProjects = await liveTargetIds(ctx, 'Project', projects);
    const landedEngagements = await liveTargetIds(
      ctx,
      'Engagement',
      engagements,
    );

    const droppedForParent: string[] = [];
    const droppedForShape: string[] = [];
    const droppedForInterval: string[] = [];
    const droppedForType: string[] = [];
    const defaultedStatuses: string[] = [];
    const droppedEnums = new Set<string>();

    const rows = dtos.flatMap((report) => {
      const dto = report as unknown as Record<string, any>;

      const typeResult = sanitizeEnum(
        [String(dto.type)],
        reportTypeEnum.enumValues,
      );
      for (const value of typeResult.dropped) {
        droppedEnums.add(`type=${value}`);
      }
      const type = typeResult.kept[0];
      if (!type) {
        droppedForType.push(report.id);
        return [];
      }
      const isProgress = type === 'Progress';

      const parent = parents.get(report.id);
      if (!parent) {
        droppedForParent.push(report.id);
        return [];
      }
      // The parent-shape CHECK ties the FK column to the type, so a Progress
      // report under a Project (or a Financial under an Engagement) cannot be
      // written either way round. Aborting the whole load on one bad row is
      // worse than dropping it loudly.
      if (isProgress !== parent.isEngagement) {
        droppedForShape.push(report.id);
        return [];
      }
      const landed = isProgress ? landedEngagements : landedProjects;
      if (!landed.has(parent.id)) {
        droppedForParent.push(report.id);
        return [];
      }

      const start = dateStr(dto.start);
      const end = dateStr(dto.end);
      if (!start || !end) {
        droppedForInterval.push(report.id);
        return [];
      }

      // status is ProgressReport-only and NOT NULL for it, per the status-shape
      // CHECK. Every progress report carries one today; default rather than drop
      // if one ever doesn't, since NotStarted is what merge() writes at creation.
      let status: string | null = null;
      if (isProgress) {
        const raw = dto.status ? String(dto.status) : null;
        if (!raw) {
          defaultedStatuses.push(report.id);
        }
        const result = sanitizeEnum(
          [raw ?? 'NotStarted'],
          progressReportStatusEnum.enumValues,
        );
        for (const value of result.dropped) {
          droppedEnums.add(`status=${value}`);
        }
        status = result.kept[0] ?? 'NotStarted';
      }

      return [
        {
          id: report.id,
          type: type as any,
          projectId: isProgress ? null : (parent.id as ID<'Project'>),
          engagementId: isProgress ? (parent.id as ID<'Engagement'>) : null,
          start,
          end,
          receivedDate: dateStr(dto.receivedDate),
          skippedReason: (dto.skippedReason as string | null) ?? null,
          reportFileId: (dto.reportFile as ID<'File'> | null) ?? null,
          narrativeFileId: (dto.narrativeFile as ID<'File'> | null) ?? null,
          narrativeReceivedDate: dateStr(dto.narrativeReceivedDate),
          status: status as any,
          createdAt: tsReq(report.createdAt),
          updatedAt: tsReq(report.createdAt),
        },
      ];
    });

    const warnDropped = (label: string, ids: readonly string[]) => {
      if (ids.length === 0) return;
      ctx.log(
        `    ⚠ DROPPED ${ids.length} report(s) ${label}: ` +
          `${ids.slice(0, 10).join(', ')}${ids.length > 10 ? ', …' : ''}`,
      );
    };
    warnDropped(
      'whose parent project/engagement never landed',
      droppedForParent,
    );
    warnDropped(
      'whose type disagreed with their parent kind (parent-shape CHECK)',
      droppedForShape,
    );
    warnDropped(
      'missing a start or end date (both NOT NULL)',
      droppedForInterval,
    );
    warnDropped('with an unrecognized report type', droppedForType);
    if (defaultedStatuses.length > 0) {
      ctx.log(
        `    ⚠ ${defaultedStatuses.length} progress report(s) had no status under a CHECK that ` +
          `requires one — defaulted to NotStarted: ${defaultedStatuses.slice(0, 10).join(', ')}`,
      );
    }
    if (droppedEnums.size > 0) {
      ctx.log(
        `    ⚠ dropped unknown periodic-report enum value(s): ${[...droppedEnums].join(', ')} ` +
          `— migration-todo: map, don't drop`,
      );
    }

    return one(
      'periodic_reports',
      dtos.length,
      await bulkInsert(ctx, periodicReports, rows),
    );
  },
};
