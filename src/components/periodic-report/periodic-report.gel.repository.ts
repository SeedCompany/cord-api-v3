import { Injectable } from '@nestjs/common';
import { type Without } from 'type-fest/source/merge-exclusive';
import {
  CalendarDate,
  EnhancedResource,
  type ID,
  type PublicOf,
  type UnsecuredDto,
} from '~/common';
import { castToEnum, e, RepoFor } from '~/core/gel';
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
  //TODO - this is close but the hydrate for ProgressReport needs worked on
  async matchCurrentDue(parentId: ID, reportType: ReportType) {
    const enhancedResource = EnhancedResource.of(
      resolveReportType({ type: reportType }),
    );
    const resource = e.cast(enhancedResource.db, e.uuid(parentId));
    const report = e.select(resource, (report) => ({
      ...this.hydrate(report),
      filter: e.all(
        e.set(
          e.op(resource.id, '=', report.container.id),
          e.op(report.end, '<', CalendarDate.now()),
        ),
      ),
      order_by: [
        { expression: report.end, direction: e.DESC },
        { expression: report.start, direction: e.ASC },
      ],
    }));
    return await this.db.run(report);
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
    //TODO - is this needed?  How does this differ from matchCurrentDue?
    throw new Error('Method not implemented.');
  }

  //TODO - this is close but the hydrate for ProgressReport needs worked on
  async getByDate(parentId: ID, date: CalendarDate, reportType: ReportType) {
    const enhancedResource = EnhancedResource.of(
      resolveReportType({ type: reportType }),
    );
    const resource = e.cast(enhancedResource.db, e.uuid(parentId));
    const report = e.select(resource, (report) => ({
      ...this.hydrate(report),
      filter: e.all(
        e.set(
          e.op(resource.id, '=', report.container.id),
          e.op(report.start, '<=', date),
          e.op(report.end, '>=', date),
        ),
      ),
    }));
    return await this.db.run(report);
  }

  //TODO - this is close but the hydrate for ProgressReport needs worked on
  async getNextDue(parentId: ID, reportType: ReportType) {
    const enhancedResource = EnhancedResource.of(
      resolveReportType({ type: reportType }),
    );
    const resource = e.cast(enhancedResource.db, e.uuid(parentId));
    const report = e.select(resource, (report) => ({
      ...this.hydrate(report),
      filter: e.all(
        e.set(
          e.op(resource.id, '=', report.container.id),
          e.op(report.end, '>', CalendarDate.now()),
        ),
      ),
      order_by: { expression: report.end, direction: e.ASC },
    }));

    return await this.db.run(report);
  }

  //TODO - this is close but the hydrate for ProgressReport needs worked on
  async getLatestReportSubmitted(parentId: ID, reportType: ReportType) {
    const enhancedResource = EnhancedResource.of(
      resolveReportType({ type: reportType }),
    );
    const resource = e.cast(enhancedResource.db, e.uuid(parentId));
    const report = e.select(resource, (report) => ({
      ...this.hydrate(report),
      filter: e.all(
        e.set(
          e.op(resource.id, '=', report.container.id),
          e.op('exists', report.reportFile),
        ),
      ),
      order_by: { expression: report.start, direction: e.DESC },
    }));

    return await this.db.run(report);
  }

  //TODO - this is close but the hydrate for ProgressReport needs worked on
  async getFinalReport(parentId: ID, reportType: ReportType) {
    const enhancedResource = EnhancedResource.of(
      resolveReportType({ type: reportType }),
    );
    const resource = e.cast(enhancedResource.db, e.uuid(parentId));
    const report = e.select(resource, (report) => ({
      ...this.hydrate(report),
      filter: e.all(
        e.set(
          e.op(resource.id, '=', report.container.id),
          e.op(report.start, '=', report.end),
        ),
      ),
      order_by: { expression: report.start, direction: e.DESC },
    }));

    return await this.db.run(report);
  }
}
