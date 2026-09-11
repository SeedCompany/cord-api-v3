import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  count,
  eq,
  inArray,
  isNull,
  sql,
  type SQL,
} from 'drizzle-orm';
import {
  EnhancedResource,
  type ID,
  type PaginatedListType,
  type UnsecuredDto,
} from '~/common';
import { Identity } from '~/core/authentication';
import {
  EMPTY_PAGE,
  orderEntries,
  type SortColumns,
  subFilter,
} from '~/core/drizzle';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import {
  engagements,
  periodicReports,
  pnpExtractionResultProblems,
  progressSummaries,
  projects,
} from '~/core/drizzle/schema';
import { PolicyExecutor } from '../authorization/policy/executor/policy-executor';
import {
  engagementFilterClauses,
  engagementSortEntry,
} from '../engagement/engagement.drizzle.repository';
import {
  dateFilterConditions,
  type PeriodicReportDrizzleRepository,
} from '../periodic-report/periodic-report.drizzle.repository';
import { PeriodicReportRepository } from '../periodic-report/periodic-report.repository';
import { periodicReportSortColumns } from '../periodic-report/periodic-report.sorts';
import { PnpProblemType } from '../pnp/extraction-result/extraction-result.dto';
import { ScheduleStatus, SummaryPeriod } from '../progress-summary/dto';
import { ProgressReport, type ProgressReportListInput } from './dto';

const ERROR_PROBLEM_TYPE_IDS = () =>
  [...PnpProblemType.types.values()]
    .filter((type) => type.severity === 'Error')
    .map((type) => type.id);

/**
 * Postgres implementation of the top-level `progressReports` query.
 *
 * Deliberately does NOT declare `implements PublicOf<ProgressReportRepository>`
 * and does not extend `DrizzleDtoRepository`: the service only ever calls
 * `.list()` on the canonical repo (readOne/create/update/delete all go through
 * PeriodicReportRepository, since Progress rows share the `periodic_reports`
 * table with every other report type). Same approach as
 * PartnershipProducingMediumDrizzleRepository.
 *
 * Hydration is delegated to PeriodicReportRepository.readMany() rather than
 * reimplemented here — its toDto() already produces a full ProgressReport
 * shape (__typename, status, parent, scope, sensitivity) for `type: 'Progress'`
 * rows. This repo's own job is just resolving ProgressReportFilters (a
 * strictly richer shape than PeriodicReportListInput's filter) into the
 * matching id set.
 */
@Injectable()
export class ProgressReportDrizzleRepository {
  private readonly resource = EnhancedResource.of(ProgressReport);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly executor: PolicyExecutor,
    private readonly identity: Identity,
    @Inject(PeriodicReportRepository)
    private readonly periodicReportRepo: PeriodicReportDrizzleRepository,
  ) {}

  private get db() {
    return this.drizzle.client;
  }

  async list(
    input: ProgressReportListInput,
  ): Promise<PaginatedListType<UnsecuredDto<ProgressReport>>> {
    const conditions: SQL[] = [
      isNull(periodicReports.deletedAt),
      eq(periodicReports.type, 'Progress'),
      // Keep this page/total in sync with PeriodicReportRepository.readMany()'s
      // own liveness gate (liveReportIds) — without it, a report under a
      // soft-deleted engagement/project inflates `total` and consumes a page
      // slot that readMany() then silently drops, short-changing the page.
      sql`exists (
        select 1 from ${engagements}
        inner join ${projects} on ${projects.id} = ${engagements.projectId}
        where ${engagements.id} = ${periodicReports.engagementId}
          and ${engagements.deletedAt} is null
          and ${projects.deletedAt} is null
      )`,
    ];
    if (!this.executor.applyReadFilter(this.resource, conditions)) {
      return EMPTY_PAGE;
    }

    const filter = input.filter;
    if (filter?.parent) {
      conditions.push(
        eq(periodicReports.engagementId, filter.parent as ID<'Engagement'>),
      );
    }
    conditions.push(
      ...dateFilterConditions(periodicReports.start, filter?.start),
    );
    conditions.push(...dateFilterConditions(periodicReports.end, filter?.end));
    if (filter?.status?.length) {
      conditions.push(inArray(periodicReports.status, [...filter.status]));
    }
    if (filter?.cumulativeSummary?.scheduleStatus?.length) {
      const condition = cumulativeScheduleStatusCondition(
        filter.cumulativeSummary.scheduleStatus,
      );
      if (condition) conditions.push(condition);
    }
    if (filter?.engagement) {
      conditions.push(
        subFilter(
          this.db,
          periodicReports.engagementId,
          engagements,
          engagementFilterClauses(
            this.db,
            filter.engagement,
            this.identity.current.userId,
          ),
        ),
      );
    }
    if (filter?.pnpExtractionResult?.hasError != null) {
      conditions.push(
        pnpHasErrorCondition(filter.pnpExtractionResult.hasError),
      );
    }

    const predicate = and(...conditions);
    const [countResult, rows] = await Promise.all([
      this.db.select({ total: count() }).from(periodicReports).where(predicate),
      this.db
        .select({ id: periodicReports.id })
        .from(periodicReports)
        .where(predicate)
        .orderBy(
          ...orderEntries(
            progressReportSortEntry(input.sort as string) ??
              periodicReports.start,
            input.order,
          ),
          asc(periodicReports.id),
        )
        .limit(input.count)
        .offset((input.page - 1) * input.count),
    ]);
    const total = countResult[0]?.total ?? 0;
    const hasMore = (input.page - 1) * input.count + rows.length < total;
    if (rows.length === 0) return { total, items: [], hasMore };

    const items = await this.periodicReportRepo.readMany(rows.map((r) => r.id));
    const byId = new Map(items.map((item) => [item.id, item]));
    return {
      total,
      hasMore,
      items: rows.flatMap((r) => byId.get(r.id) ?? []) as Array<
        UnsecuredDto<ProgressReport>
      >,
    };
  }
}

/**
 * A summary period's variance for the report in scope. Neo4j sorts BOTH
 * `variance` and `scheduleStatus` by this same number — `progressSummarySorters`
 * returns `actual - planned` for either key — so the buckets never enter the
 * ordering, and a report with no summary for the period sorts blank.
 */
const summaryVariance = (period: SummaryPeriod): SQL => sql`(
  select ${progressSummaries.actual} - ${progressSummaries.planned}
  from ${progressSummaries}
  where ${progressSummaries.reportId} = ${periodicReports.id}
    and ${progressSummaries.period} = ${period}
)`;

/** One summary period's sortable values, for a `<period>Summary.*` sort key. */
const summarySortEntry = (
  period: SummaryPeriod,
  key: string,
): SortColumns | undefined => {
  if (key === 'variance' || key === 'scheduleStatus') {
    return summaryVariance(period);
  }
  const column = {
    planned: progressSummaries.planned,
    actual: progressSummaries.actual,
  }[key];
  if (!column) return undefined;
  return sql`(
    select ${column} from ${progressSummaries}
    where ${progressSummaries.reportId} = ${periodicReports.id}
      and ${progressSummaries.period} = ${period}
  )`;
};

/**
 * Resolve a progress-report sort key, including the prefixes Neo4j answers by
 * delegating: `engagement.*` (which reaches on through to `project.*` and
 * `language.*`) and the three summary periods.
 *
 * The dashboard widgets sort by `engagement.project.name`,
 * `engagement.language.displayName` and `cumulativeSummary.scheduleStatus`,
 * none of which resolved before — they fell through to the `start` fallback.
 *
 * `pnpExtractionResult.totalErrors` is answered too, though nothing sends it
 * yet: the PnP widget's Errors column sends the DOTLESS `pnpExtractionResult`,
 * which matches neither this nor Neo4j's `pnpExtractionResult.*` prefix, so
 * that column sorts on neither engine today. The UI handoff covers changing it.
 */
const progressReportSortEntry = (sort: string): SortColumns | undefined => {
  if (sort.startsWith('engagement.')) {
    return engagementSortEntry(
      sort.slice('engagement.'.length),
      sql`${periodicReports.engagementId}`,
    );
  }
  for (const [prefix, period] of [
    ['cumulativeSummary.', SummaryPeriod.Cumulative],
    ['fiscalYearSummary.', SummaryPeriod.FiscalYearSoFar],
    ['periodSummary.', SummaryPeriod.ReportPeriod],
  ] as const) {
    if (sort.startsWith(prefix)) {
      return summarySortEntry(period, sort.slice(prefix.length));
    }
  }
  if (sort === 'pnpExtractionResult.totalErrors') {
    return totalPnpErrors();
  }
  return periodicReportSortColumns[
    sort as keyof typeof periodicReportSortColumns
  ];
};

/**
 * How many Error-severity problems the report's PnP file recorded — the one key
 * Neo4j's `pnpExtractionResultSorters` defines. Severity is a code-side
 * registry rather than a stored column, so the matching type ids are resolved
 * per call and inlined, exactly as `pnpHasErrorCondition` does for the filter.
 *
 * ⚠ A report whose file has no extraction result counts 0 here and stays in the
 * list. Neo4j DROPS it instead: `progressReportExtrasSorters`'
 * `pnpExtractionResult.*` matcher reaches the result through a required MATCH
 * with no aggregation at that level, so a report without one produces no row.
 * Counting zero is the sane reading and the one that survives cutover, but it
 * is a deliberate difference — which is why the PnP widget's Errors column
 * should stay unsortable until Neo4j is gone. See the UI handoff.
 */
const totalPnpErrors = (): SQL => {
  const errorTypeIds = ERROR_PROBLEM_TYPE_IDS();
  if (errorTypeIds.length === 0) return sql`0`;
  return sql`(
    select count(*) from ${pnpExtractionResultProblems}
    where ${pnpExtractionResultProblems.fileId} = ${periodicReports.reportFileId}
      and ${inArray(pnpExtractionResultProblems.type, errorTypeIds)}
  )`;
};

/**
 * Mirrors the Neo4j `progressSummaryFilters`'s `scheduleStatus` matcher: a
 * report's cumulative-period summary (if any) buckets into Ahead/Behind/OnTime
 * by `actual - planned`, using the same thresholds as
 * `ScheduleStatus.fromVariance`. No cumulative summary row at all is its own
 * `null` bucket.
 */
const cumulativeScheduleStatusCondition = (
  statuses: ReadonlyArray<ScheduleStatus | null>,
): SQL | undefined => {
  const wanted = new Set(statuses);
  if (wanted.size === 0) return undefined;

  const variance = sql`(
    select ${progressSummaries.actual} - ${progressSummaries.planned}
    from ${progressSummaries}
    where ${progressSummaries.reportId} = ${periodicReports.id}
      and ${progressSummaries.period} = ${SummaryPeriod.Cumulative}
  )`;

  if (wanted.size === 1 && wanted.has(null)) {
    return sql`(${variance}) is null`;
  }

  const branches: SQL[] = [];
  if (wanted.has(null)) branches.push(sql`(${variance}) is null`);
  if (wanted.has(ScheduleStatus.Ahead)) branches.push(sql`(${variance}) > 0.3`);
  if (wanted.has(ScheduleStatus.Behind))
    branches.push(sql`(${variance}) < -0.1`);
  if (wanted.has(ScheduleStatus.OnTime)) {
    branches.push(sql`(${variance}) between -0.1 and 0.3`);
  }
  return branches.length ? sql.join(branches, sql` or `) : undefined;
};

/**
 * Mirrors the Neo4j `pnpExtractionResultFilters`'s `hasError`: does the
 * report's `reportFile` have any recorded problem whose registered
 * `PnpProblemType` severity is `Error`. Severity is a code-side registry
 * (`PnpProblemType.types`), not a stored column, so the matching type ids are
 * resolved once per call and inlined as the `IN` list.
 */
const pnpHasErrorCondition = (wantError: boolean): SQL => {
  const errorTypeIds = ERROR_PROBLEM_TYPE_IDS();
  if (errorTypeIds.length === 0) {
    return wantError ? sql`false` : sql`true`;
  }
  const exists = sql`exists (
    select 1 from ${pnpExtractionResultProblems}
    where ${pnpExtractionResultProblems.fileId} = ${periodicReports.reportFileId}
      and ${inArray(pnpExtractionResultProblems.type, errorTypeIds)}
  )`;
  return wantError ? exists : sql`not (${exists})`;
};
