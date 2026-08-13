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
  resolveOrderBy,
  type SortMap,
  subFilter,
} from '~/core/drizzle';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import {
  engagements,
  periodicReports,
  pnpExtractionResultProblems,
  progressSummaries,
} from '~/core/drizzle/schema';
import { PolicyExecutor } from '../authorization/policy/executor/policy-executor';
import { engagementFilterClauses } from '../engagement/engagement.drizzle.repository';
import {
  dateFilterConditions,
  type PeriodicReportDrizzleRepository,
} from '../periodic-report/periodic-report.drizzle.repository';
import { PeriodicReportRepository } from '../periodic-report/periodic-report.repository';
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

    const sortColumns = {
      start: periodicReports.start,
      end: periodicReports.end,
      status: periodicReports.status,
      receivedDate: periodicReports.receivedDate,
      narrativeReceivedDate: periodicReports.narrativeReceivedDate,
      createdAt: periodicReports.createdAt,
    } satisfies SortMap<string>;

    const predicate = and(...conditions);
    const [countResult, rows] = await Promise.all([
      this.db.select({ total: count() }).from(periodicReports).where(predicate),
      this.db
        .select({ id: periodicReports.id })
        .from(periodicReports)
        .where(predicate)
        .orderBy(
          ...resolveOrderBy(input, sortColumns, periodicReports.start),
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
