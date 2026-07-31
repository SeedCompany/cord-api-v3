import { Injectable } from '@nestjs/common';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  not,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  CalendarDate,
  type DateFilter,
  generateId,
  type ID,
  isSecured,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { Identity } from '~/core/authentication';
import { type ChangesOf } from '~/core/database/changes';
import {
  DrizzleDtoRepository,
  resolveOrderBy,
  type SortMap,
} from '~/core/drizzle';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import {
  engagements,
  fileNodes,
  periodicReports,
  projects,
} from '~/core/drizzle/schema';
import { type BaseNode } from '~/core/neo4j/results';
import { type ScopedRole } from '../authorization/dto/role.dto';
import { FileService } from '../file';
import { ProgressReportStatus } from '../progress-report/dto';
import { requesterScopeByProject } from '../project/project-member/membership-scope';
import {
  IPeriodicReport,
  type MergePeriodicReports,
  type PeriodicReport,
  type PeriodicReportListInput,
  type ReportType,
  type UpdatePeriodicReport,
} from './dto';
import { deterministicReportId } from './periodic-report.repository';

type ReportRow = typeof periodicReports.$inferSelect & {
  project?: ParentProject | null;
  engagement?: {
    id: ID<'Engagement'>;
    createdAt: Date;
    project?: ParentProject | null;
  } | null;
};

interface ParentProject {
  id: ID<'Project'>;
  type: string;
  sensitivity: string;
  createdAt: Date;
}

const PROJECT_COLUMNS = {
  columns: { id: true, type: true, sensitivity: true, createdAt: true },
} as const;

const RELATIONS = {
  project: PROJECT_COLUMNS,
  engagement: {
    columns: { id: true, createdAt: true },
    with: { project: PROJECT_COLUMNS },
  },
} as const;

@Injectable()
export class PeriodicReportDrizzleRepository extends DrizzleDtoRepository<
  typeof periodicReports,
  PeriodicReport & { id: ID }
> {
  constructor(
    db: DrizzleService,
    private readonly identity: Identity,
    private readonly files: FileService,
  ) {
    super(db, periodicReports, IPeriodicReport as any);
  }

  /**
   * Idempotent bulk-create. Ids are deterministic per
   * (parent, type, start, end) — identical to the Neo4j derivation — so
   * existing intervals and concurrent duplicate syncs both resolve via
   * ON CONFLICT DO NOTHING. Returns only the rows actually created.
   */
  async merge(input: MergePeriodicReports) {
    // Nothing to sync — drizzle's `.values([])` is a runtime error, and there
    // are no rows to create files for, so short-circuit.
    if (input.intervals.length === 0) {
      return [];
    }
    const isProgress = input.type === 'Progress';
    // Each report owns a `reportFile` DefinedFile placeholder. The FK is stored
    // here; the (version-less) file node is created by createDefinedFile after
    // the rows land, only for those actually inserted.
    const reportFileIds = new Map<ID, ID<'File'>>();
    // narrativeFile placeholder mirrors the Neo4j merge, which creates both
    // DefinedFiles per report (develop's narrativeFile PR postdates mono).
    const narrativeFileIds = new Map<ID, ID<'File'>>();
    // The deterministic id is a *first choice*, not a guarantee, now that
    // reports soft-delete (0034): a dead row can still hold it, and Neo4j in
    // that situation creates a brand-new report rather than reviving the old one
    // (its soft delete strips the label the uniqueness constraint is scoped to,
    // so it can even reuse the id string — we can't, `id` is the PK). Mirror the
    // behaviour, not the id: dead row keeps its id and content, the new live row
    // takes a fresh one. Liveness dedup comes from
    // `periodic_reports_live_interval_uniq`, not from the id.
    const wanted = input.intervals.map((interval) =>
      deterministicReportId(
        input.parent,
        input.type,
        interval.start,
        interval.end,
      ),
    );
    const taken = new Set(
      (
        await this.db
          .select({ id: periodicReports.id })
          .from(periodicReports)
          .where(inArray(periodicReports.id, wanted))
      ).map((row) => row.id),
    );
    const values = await Promise.all(
      input.intervals.map(async (interval, i) => {
        const preferred = wanted[i]!;
        const id = taken.has(preferred)
          ? await generateId<ID<'PeriodicReport'>>()
          : preferred;
        const reportFileId = await generateId<ID<'File'>>();
        reportFileIds.set(id, reportFileId);
        const narrativeFileId = await generateId<ID<'File'>>();
        narrativeFileIds.set(id, narrativeFileId);
        return {
          id,
          type: input.type,
          projectId: isProgress ? null : (input.parent as ID<'Project'>),
          engagementId: isProgress ? (input.parent as ID<'Engagement'>) : null,
          start: interval.start.toISODate(),
          end: interval.end.toISODate(),
          status: isProgress ? ProgressReportStatus.NotStarted : null,
          reportFileId,
          narrativeFileId,
        };
      }),
    );
    const inserted = await this.db
      .insert(periodicReports)
      .values(values)
      // Untargeted: a concurrent writer can now lose on EITHER the id PK (both
      // picked the same free deterministic id) or the live-interval unique index
      // (both fell back to fresh ids for the same revived interval). Targeting
      // only the id would let the second case throw.
      .onConflictDoNothing()
      .returning({
        id: periodicReports.id,
        start: periodicReports.start,
        end: periodicReports.end,
      });

    if (inserted.length > 0) {
      // Progress reports of Multiplication projects are publicly downloadable —
      // mirrors the Neo4j reportFilePublic rule. Others are private.
      const isPublic = isProgress && (await this.parentIsMultiplication(input));
      for (const row of inserted) {
        await this.files.createDefinedFile(
          reportFileIds.get(row.id)!,
          row.end,
          row.id,
          'reportFile',
          undefined,
          isPublic,
        );
        // Same public rule as reportFile — mirrors the Neo4j merge, where
        // both file nodes take the one isFilePublic flag.
        await this.files.createDefinedFile(
          narrativeFileIds.get(row.id)!,
          row.end,
          row.id,
          'narrativeFile',
          undefined,
          isPublic,
        );
      }
    }

    return inserted.map((row) => ({
      id: row.id,
      interval: {
        start: CalendarDate.fromISO(row.start),
        end: CalendarDate.fromISO(row.end),
      },
    }));
  }

  /** Is the merge's parent (engagement, for Progress) under a Multiplication project? */
  private async parentIsMultiplication(
    input: MergePeriodicReports,
  ): Promise<boolean> {
    const [row] = await this.db
      .select({ type: projects.type })
      .from(engagements)
      .innerJoin(projects, eq(projects.id, engagements.projectId))
      .where(eq(engagements.id, input.parent as ID<'Engagement'>))
      .limit(1);
    return row?.type === 'MultiplicationTranslation';
  }

  async update<T extends PeriodicReport | UnsecuredDto<PeriodicReport>>(
    existing: T,
    simpleChanges: Omit<
      ChangesOf<PeriodicReport, UpdatePeriodicReport>,
      'reportFile' | 'narrativeFile'
    > &
      Partial<Pick<PeriodicReport, 'start' | 'end'>>,
  ): Promise<T> {
    const changes = simpleChanges as Record<string, unknown>;
    await this.updateColumns(existing.id, {
      ...('receivedDate' in changes && {
        receivedDate:
          (changes.receivedDate as CalendarDate | null)?.toISODate() ?? null,
      }),
      ...('narrativeReceivedDate' in changes && {
        narrativeReceivedDate:
          (changes.narrativeReceivedDate as CalendarDate | null)?.toISODate() ??
          null,
      }),
      ...('skippedReason' in changes && {
        skippedReason: changes.skippedReason as string | null,
      }),
      ...('start' in changes && {
        start: (changes.start as CalendarDate).toISODate(),
      }),
      ...('end' in changes && {
        end: (changes.end as CalendarDate).toISODate(),
      }),
    });
    // Merge changes into the given object, secured-aware — same contract as
    // the Neo4j base's updateProperties().
    const updated: Record<string, unknown> = { ...existing };
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) continue;
      const prev = updated[key];
      updated[key] = isSecured(prev) ? { ...prev, value } : value;
    }
    return updated as T;
  }

  override async readMany(
    ids: readonly ID[],
  ): Promise<Array<UnsecuredDto<PeriodicReport>>> {
    if (ids.length === 0) return [];
    const rows = await this.db.query.periodicReports.findMany({
      where: (report) =>
        and(inArray(report.id, [...ids]), isNull(report.deletedAt)),
      with: RELATIONS,
    });
    return await this.hydrate(rows as ReportRow[]);
  }

  async list(input: PeriodicReportListInput) {
    const conditions: SQL[] = [isNull(periodicReports.deletedAt)];
    if (input.type) {
      conditions.push(eq(periodicReports.type, input.type));
    }
    if (input.parent) {
      conditions.push(
        or(
          eq(periodicReports.projectId, input.parent as ID<'Project'>),
          eq(periodicReports.engagementId, input.parent as ID<'Engagement'>),
        )!,
      );
    }
    for (const [column, filter] of [
      [periodicReports.start, input.start],
      [periodicReports.end, input.end],
    ] as const) {
      conditions.push(...dateFilterConditions(column, filter));
    }
    const sortColumns = {
      start: periodicReports.start,
      end: periodicReports.end,
      type: periodicReports.type,
      status: periodicReports.status,
      receivedDate: periodicReports.receivedDate,
      narrativeReceivedDate: periodicReports.narrativeReceivedDate,
      createdAt: periodicReports.createdAt,
      // migration-todo: keys beyond these (skippedReason, status, computed
      // fields) fall back to `start` — the R4 resolveOrderBy convention;
      // central unknown-key throw is the tracked fix.
    } satisfies SortMap<string>;
    const { rows, total, hasMore } = await this.paginatedSelect({
      predicate: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: resolveOrderBy(input, sortColumns, periodicReports.start),
      page: input.page,
      count: input.count,
    });
    if (rows.length === 0) return { total, items: [], hasMore };
    const items = await this.readMany(rows.map((r) => r.id));
    const byId = new Map(items.map((i) => [i.id, i]));
    return {
      total,
      hasMore,
      items: rows.map((r) => byId.get(r.id)!).filter(Boolean),
    };
  }

  matchCurrentDue(_parentId: unknown, _reportType: ReportType): never {
    // Only consumed by the Neo4j product-progress repo as a cypher fragment.
    // migration-todo: remove when ProductProgress ports — its drizzle repo
    // queries current-due reports directly in SQL.
    throw new ServerException(
      'matchCurrentDue is a cypher fragment; use getCurrentDue under postgres',
    );
  }

  async getByDate(parentId: ID, date: CalendarDate, reportType: ReportType) {
    const day = date.toISODate();
    return await this.first(
      and(
        this.parentCondition(parentId, reportType),
        lte(periodicReports.start, day),
        gte(periodicReports.end, day),
      ),
    );
  }

  async getCurrentDue(parentId: ID, reportType: ReportType) {
    return await this.first(
      and(
        this.parentCondition(parentId, reportType),
        lt(periodicReports.end, today()),
      ),
      [desc(periodicReports.end), asc(periodicReports.start)],
    );
  }

  async getNextDue(parentId: ID, reportType: ReportType) {
    return await this.first(
      and(
        this.parentCondition(parentId, reportType),
        gt(periodicReports.end, today()),
      ),
      [asc(periodicReports.end)],
    );
  }

  async getLatestReportSubmitted(parentId: ID, type: ReportType) {
    // "Submitted" = a FileVersion exists under either of the report's files —
    // the Neo4j guard is `(node)-->(:FileNode)<--(:FileVersion)`, which spans
    // reportFile AND narrativeFile. Ordered by start (not end), per Neo4j.
    return await this.first(
      and(this.parentCondition(parentId, type), hasUploadedFileVersion()),
      [desc(periodicReports.start)],
    );
  }

  async getFinalReport(parentId: ID, type: ReportType) {
    return await this.first(
      and(
        this.parentCondition(parentId, type),
        eq(periodicReports.start, periodicReports.end),
      ),
    );
  }

  /**
   * Soft-deletes reports of type under the parent — same as Neo4j, whose
   * `deleteBaseNode` sets `deletedAt` and relabels to `Deleted_*` rather than
   * removing anything (migration 0034, ledger PC-14).
   *
   * Because nothing is destroyed, the eligibility rules can now be exactly
   * Neo4j's, with no extra content guard: progress reports only while still
   * NotStarted; non-progress reports only while no file has been uploaded to
   * either DefinedFile. A report's media, variance explanation and workflow
   * events all survive the removal, attached to the dead row.
   */
  async delete(
    baseNodeId: ID,
    type: ReportType,
    intervals: ReadonlyArray<{
      start: CalendarDate | null;
      end: CalendarDate | null;
    }>,
  ) {
    const intervalConditions = intervals.flatMap((interval) => {
      if (!interval.start && !interval.end) return [];
      if (!interval.start) {
        return [lte(periodicReports.end, interval.end!.toISODate())];
      }
      if (!interval.end) {
        return [gte(periodicReports.start, interval.start.toISODate())];
      }
      return [
        and(
          eq(periodicReports.start, interval.start.toISODate()),
          eq(periodicReports.end, interval.end.toISODate()),
        )!,
      ];
    });
    if (intervalConditions.length === 0) return { count: 0 };
    const deleted = await this.db
      .update(periodicReports)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          this.parentCondition(baseNodeId, type),
          or(...intervalConditions),
          ...(type === 'Progress'
            ? [eq(periodicReports.status, ProgressReportStatus.NotStarted)]
            : // Non-progress reports are removable only while no file has been
              // uploaded to EITHER DefinedFile — mirrors the Neo4j
              // reportFileNode + narrativeFileNode FileVersion guards.
              [not(hasUploadedFileVersion())]),
        ),
      )
      .returning({ id: periodicReports.id });
    return { count: deleted.length };
  }

  /**
   * Every caller wants LIVE reports, `delete()` included (re-removing an
   * already-dead report is a no-op, not a second event), so liveness lives here
   * rather than being repeated at seven call sites. @see migration 0034
   */
  private parentCondition(parentId: ID, type: ReportType) {
    return and(
      isNull(periodicReports.deletedAt),
      eq(periodicReports.type, type),
      type === 'Progress'
        ? eq(periodicReports.engagementId, parentId as ID<'Engagement'>)
        : eq(periodicReports.projectId, parentId as ID<'Project'>),
    )!;
  }

  private async first(predicate: SQL | undefined, orderBy: SQL[] = []) {
    const [row] = await this.db
      .select({ id: periodicReports.id })
      .from(periodicReports)
      .where(predicate)
      .orderBy(...orderBy, asc(periodicReports.id))
      .limit(1);
    if (!row) return undefined;
    const [dto] = await this.readMany([row.id]);
    return dto;
  }

  private async hydrate(
    rows: ReportRow[],
  ): Promise<Array<UnsecuredDto<PeriodicReport>>> {
    const scopeByProject = await requesterScopeByProject(
      this.db,
      this.identity.current.userId,
      rows.flatMap((r) => this.parentProject(r)?.id ?? []),
    );
    return rows.map((row) => {
      const project = this.parentProject(row);
      return this.toDto(
        row,
        project ? (scopeByProject.get(project.id) ?? []) : [],
      );
    });
  }

  private parentProject(row: ReportRow): ParentProject | undefined {
    return row.project ?? row.engagement?.project ?? undefined;
  }

  protected toDto(
    row: ReportRow,
    scope: ScopedRole[] = [],
  ): UnsecuredDto<PeriodicReport> {
    const project = this.parentProject(row);
    if (!project) {
      throw new ServerException(
        `PeriodicReport ${row.id} has no parent row — FK invariant violated`,
      );
    }
    const isProgress = row.type === 'Progress';
    // Neo4j-shaped BaseNode so ResourceLoader.loadByBaseNode() on the parent
    // field keeps working — only labels + properties.{id,createdAt} are read.
    const parent: BaseNode = isProgress
      ? {
          identity: row.engagement!.id,
          labels: ['LanguageEngagement', 'Engagement', 'BaseNode'],
          properties: {
            id: row.engagement!.id,
            createdAt: DateTime.fromJSDate(row.engagement!.createdAt),
          },
        }
      : {
          identity: project.id,
          labels: [`${project.type}Project`, 'Project', 'BaseNode'],
          properties: {
            id: project.id,
            createdAt: DateTime.fromJSDate(project.createdAt),
          },
        };
    const dto: unknown = {
      id: row.id,
      type: row.type,
      ...(isProgress && { __typename: 'ProgressReport', status: row.status }),
      parent,
      start: CalendarDate.fromISO(row.start),
      end: CalendarDate.fromISO(row.end),
      receivedDate: row.receivedDate
        ? CalendarDate.fromISO(row.receivedDate)
        : null,
      narrativeReceivedDate: row.narrativeReceivedDate
        ? CalendarDate.fromISO(row.narrativeReceivedDate)
        : null,
      skippedReason: row.skippedReason,
      reportFile: row.reportFileId,
      narrativeFile: row.narrativeFileId,
      sensitivity: project.sensitivity,
      scope,
      createdAt: DateTime.fromJSDate(row.createdAt),
      canDelete: true,
    };
    return dto as UnsecuredDto<PeriodicReport>;
  }
}

const today = () => CalendarDate.local().toISODate();

/**
 * A live FileVersion exists under either of the report's DefinedFiles
 * (reportFile or narrativeFile) — the PG mirror of Neo4j's
 * `(report)-->(:FileNode)<--(:FileVersion)` reachability. Used both as the
 * "submitted" test and (negated) as the delete-eligibility guard.
 */
const hasUploadedFileVersion = () =>
  sql`exists (
    select 1 from ${fileNodes} fv
    where fv.parent_id in (${periodicReports.reportFileId}, ${periodicReports.narrativeFileId})
      and fv.type = 'FileVersion'
      and fv.deleted_at is null
  )`;

const dateFilterConditions = (
  column: typeof periodicReports.start | typeof periodicReports.end,
  filter: DateFilter | undefined,
): SQL[] => {
  if (!filter) return [];
  return [
    ...(filter.after ? [gt(column, filter.after.toISODate())] : []),
    ...(filter.afterInclusive
      ? [gte(column, filter.afterInclusive.toISODate())]
      : []),
    ...(filter.before ? [lt(column, filter.before.toISODate())] : []),
    ...(filter.beforeInclusive
      ? [lte(column, filter.beforeInclusive.toISODate())]
      : []),
  ];
};
