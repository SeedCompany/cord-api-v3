import { Injectable } from '@nestjs/common';
import { type Query } from 'cypher-query-builder';
import { type Without } from 'type-fest/source/merge-exclusive';
import {
  type CalendarDate,
  EnhancedResource,
  type ID,
  type PublicOf,
  type UnsecuredDto,
} from '~/common';
import { castToEnum, e, RepoFor } from '~/core/gel';
import { type Variable } from '../../core/database/query';
import { type ProgressReport } from '../progress-report/dto';
import {
  type FinancialReport,
  IPeriodicReport,
  type NarrativeReport,
  ReportType,
  resolveReportType,
} from './dto';
import { type PeriodicReportRepository } from './periodic-report.repository';

@Injectable()
export class PeriodicReportGelRepository
  extends RepoFor(IPeriodicReport, {
    hydrate: (periodicReport) => ({
      ...periodicReport['*'],
      type: castToEnum(periodicReport.__type__.name.slice(9, -7), ReportType),
      reportFile: true,
      sensitivity: periodicReport.container.is(e.Project.ContextAware)
        .sensitivity,
      scope: false,
      parent: e.select({
        identity: periodicReport.id,
        labels: e.array_agg(e.set(periodicReport.__type__.name.slice(9, null))),
        properties: e.select({
          id: periodicReport.id,
          createdAt: periodicReport.createdAt,
        }),
      }),
    }),
    omit: ['create'],
  })
  implements PublicOf<PeriodicReportRepository>
{
  matchCurrentDue(
    _parentId: ID | Variable,
    _reportType: ReportType,
  ): (query: Query) => Query {
    throw new Error('Method not implemented.');
  }

  async getByDate(parentId: ID, date: CalendarDate, reportType: ReportType) {
    const enhancedResource = EnhancedResource.of(
      resolveReportType({ type: reportType }),
    );
    const resource = e.cast(enhancedResource.db, e.uuid(parentId));

    const report = e.select(resource, (report) => ({
      filter: e.all(
        e.set(
          e.op(resource.id, '=', report.container.id),
          e.op(report.start, '<=', date),
          e.op(report.end, '>=', date),
        ),
      ),
    }));

    const query = e.select(report, this.hydrate);

    return await this.db.run(query);
  }

  getCurrentDue(
    _parentId: ID,
    _reportType: ReportType,
  ): Promise<
    | UnsecuredDto<
        | (Without<
            | (Without<FinancialReport, NarrativeReport> & NarrativeReport)
            | (Without<NarrativeReport, FinancialReport> & FinancialReport),
            ProgressReport
          > &
            ProgressReport)
        | (Without<
            ProgressReport,
            | (Without<FinancialReport, NarrativeReport> & NarrativeReport)
            | (Without<NarrativeReport, FinancialReport> & FinancialReport)
          > &
            (
              | (Without<FinancialReport, NarrativeReport> & NarrativeReport)
              | (Without<NarrativeReport, FinancialReport> & FinancialReport)
            ))
      >
    | undefined
  > {
    throw new Error('Method not implemented.');
  }

  getNextDue(
    _parentId: ID,
    _reportType: ReportType,
  ): Promise<
    | UnsecuredDto<
        | (Without<
            | (Without<FinancialReport, NarrativeReport> & NarrativeReport)
            | (Without<NarrativeReport, FinancialReport> & FinancialReport),
            ProgressReport
          > &
            ProgressReport)
        | (Without<
            ProgressReport,
            | (Without<FinancialReport, NarrativeReport> & NarrativeReport)
            | (Without<NarrativeReport, FinancialReport> & FinancialReport)
          > &
            (
              | (Without<FinancialReport, NarrativeReport> & NarrativeReport)
              | (Without<NarrativeReport, FinancialReport> & FinancialReport)
            ))
      >
    | undefined
  > {
    throw new Error('Method not implemented.');
  }

  getLatestReportSubmitted(
    _parentId: ID,
    _type: ReportType,
  ): Promise<
    | UnsecuredDto<
        | (Without<
            | (Without<FinancialReport, NarrativeReport> & NarrativeReport)
            | (Without<NarrativeReport, FinancialReport> & FinancialReport),
            ProgressReport
          > &
            ProgressReport)
        | (Without<
            ProgressReport,
            | (Without<FinancialReport, NarrativeReport> & NarrativeReport)
            | (Without<NarrativeReport, FinancialReport> & FinancialReport)
          > &
            (
              | (Without<FinancialReport, NarrativeReport> & NarrativeReport)
              | (Without<NarrativeReport, FinancialReport> & FinancialReport)
            ))
      >
    | undefined
  > {
    throw new Error('Method not implemented.');
  }

  getFinalReport(
    _parentId: ID,
    _type: ReportType,
  ): Promise<
    | UnsecuredDto<
        | (Without<
            | (Without<FinancialReport, NarrativeReport> & NarrativeReport)
            | (Without<NarrativeReport, FinancialReport> & FinancialReport),
            ProgressReport
          > &
            ProgressReport)
        | (Without<
            ProgressReport,
            | (Without<FinancialReport, NarrativeReport> & NarrativeReport)
            | (Without<NarrativeReport, FinancialReport> & FinancialReport)
          > &
            (
              | (Without<FinancialReport, NarrativeReport> & NarrativeReport)
              | (Without<NarrativeReport, FinancialReport> & FinancialReport)
            ))
      >
    | undefined
  > {
    throw new Error('Method not implemented.');
  }
}
