import { Injectable } from '@nestjs/common';
import { Query } from 'cypher-query-builder';
import { Without } from 'type-fest/source/merge-exclusive';
import {
  CalendarDate,
  EnhancedResource,
  ID,
  PublicOf,
  Range,
  Session,
  UnsecuredDto,
} from '~/common';
import { castToEnum, e, RepoFor } from '~/core/edgedb';
import { Variable } from '../../core/database/query';
import { ProgressReport } from '../progress-report/dto';
import {
  FinancialReport,
  IPeriodicReport,
  MergePeriodicReports,
  NarrativeReport,
  ReportType,
  resolveReportType,
} from './dto';
import { PeriodicReportRepository } from './periodic-report.repository';

@Injectable()
export class PeriodicReportEdgeDBRepository
  extends RepoFor(IPeriodicReport, {
    hydrate: (periodicReport) => ({
      ...periodicReport['*'],
      type: castToEnum(periodicReport.__type__.name.slice(9, -7), ReportType),
      reportFile: true,
      sensitivity: periodicReport.container.is(e.Project.ContextAware)
        .sensitivity,
      scope: false,
      parent: e.tuple({
        identity: periodicReport.id,
        labels: e.array_agg(e.set(periodicReport.__type__.name.slice(9, null))),
        properties: e.tuple({
          id: periodicReport.id,
          createdAt: periodicReport.createdAt,
        }),
      }),
    }),
  })
  implements PublicOf<PeriodicReportRepository>
{
  merge(
    input: MergePeriodicReports,
  ): Promise<ReadonlyArray<{ id: ID; interval: Range<CalendarDate> }>> {
    throw new Error('Method not implemented.');
  }

  matchCurrentDue(
    parentId: ID | Variable,
    reportType: ReportType,
  ): (query: Query) => Query {
    throw new Error('Method not implemented.');
  }

  async getByDate(
    parentId: ID,
    date: CalendarDate,
    reportType: ReportType,
    _session: Session,
  ) {
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
    parentId: ID,
    reportType: ReportType,
    session: Session,
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
    parentId: ID,
    reportType: ReportType,
    session: Session,
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
    parentId: ID,
    type: ReportType,
    session: Session,
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
    parentId: ID,
    type: ReportType,
    session: Session,
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
