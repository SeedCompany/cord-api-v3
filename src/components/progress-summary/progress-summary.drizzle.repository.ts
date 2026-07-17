import { Injectable } from '@nestjs/common';
import { and, inArray, isNull, sql } from 'drizzle-orm';
import { type ID } from '~/common';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import {
  periodicReports,
  products,
  progressSummaries,
} from '~/core/drizzle/schema';
import { type ProgressReport } from '../progress-report/dto';
import {
  type FetchedSummaries,
  type ProgressSummary,
  SummaryPeriod,
} from './dto';

@Injectable()
export class ProgressSummaryDrizzleRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  protected get db() {
    return this.drizzle.client;
  }

  async readMany(reportIds: readonly ID[]): Promise<FetchedSummaries[]> {
    if (reportIds.length === 0) return [];
    const reports = await this.db
      .select({
        id: periodicReports.id,
        engagementId: periodicReports.engagementId,
      })
      .from(periodicReports)
      .where(inArray(periodicReports.id, [...reportIds]));
    const engagementIds = [
      ...new Set(reports.flatMap((r) => r.engagementId ?? [])),
    ];
    const totals =
      engagementIds.length > 0
        ? await this.db
            .select({
              engagementId: products.engagementId,
              totalVerses: sql<number>`sum(${products.totalVerses})::float`,
              totalVerseEquivalents: sql<number>`sum(${products.totalVerseEquivalents})::float`,
            })
            .from(products)
            .where(
              and(
                inArray(products.engagementId, engagementIds),
                isNull(products.deletedAt),
              ),
            )
            .groupBy(products.engagementId)
        : [];
    const totalsByEngagement = new Map(totals.map((t) => [t.engagementId, t]));
    const summaries = await this.db
      .select()
      .from(progressSummaries)
      .where(inArray(progressSummaries.reportId, [...reportIds]));
    const byReport = new Map<ID, Map<string, ProgressSummary>>();
    for (const row of summaries) {
      const map = byReport.get(row.reportId) ?? new Map();
      map.set(row.period, { planned: row.planned, actual: row.actual });
      byReport.set(row.reportId, map);
    }
    return reports.map((report) => {
      const t = report.engagementId
        ? totalsByEngagement.get(report.engagementId)
        : undefined;
      const periods = byReport.get(report.id);
      const dto: unknown = {
        report: { __typename: 'ProgressReport', id: report.id },
        totalVerses: t?.totalVerses ?? 0,
        totalVerseEquivalents: t?.totalVerseEquivalents ?? 0,
        [SummaryPeriod.ReportPeriod]:
          periods?.get(SummaryPeriod.ReportPeriod) ?? null,
        [SummaryPeriod.FiscalYearSoFar]:
          periods?.get(SummaryPeriod.FiscalYearSoFar) ?? null,
        [SummaryPeriod.Cumulative]:
          periods?.get(SummaryPeriod.Cumulative) ?? null,
      };
      return dto as FetchedSummaries;
    });
  }

  async save(
    report: ProgressReport,
    period: SummaryPeriod,
    data: ProgressSummary,
  ) {
    await this.db
      .insert(progressSummaries)
      .values({
        reportId: report.id,
        period,
        planned: data.planned,
        actual: data.actual,
      })
      .onConflictDoUpdate({
        target: [progressSummaries.reportId, progressSummaries.period],
        set: {
          planned: data.planned,
          actual: data.actual,
          updatedAt: new Date(),
        },
      });
  }
}
