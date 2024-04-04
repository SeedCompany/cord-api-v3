import { EventsHandler, ILogger, Logger } from '~/core';
import { ReportType } from '../../periodic-report/dto';
import { PeriodicReportUploadedEvent } from '../../periodic-report/events';
import { SummaryPeriod } from '../dto';
import { ProgressSummaryExtractor } from '../progress-summary.extractor';
import { ProgressSummaryRepository } from '../progress-summary.repository';

@EventsHandler(PeriodicReportUploadedEvent)
export class ExtractPnpFileOnUploadHandler {
  constructor(
    private readonly repo: ProgressSummaryRepository,
    private readonly extractor: ProgressSummaryExtractor,
    @Logger('progress-summary:extractor') private readonly logger: ILogger,
  ) {}

  async handle(event: PeriodicReportUploadedEvent) {
    if (event.report.type !== ReportType.Progress) {
      return;
    }

    this.logger.info('Extracting progress summary', {
      report: event.report.id,
      userId: event.session.userId,
      fileId: event.file.id,
    });

    let extracted;
    try {
      extracted = await this.extractor.extract(event.file, event.report.start);
    } catch (e) {
      this.logger.warning(e.message, {
        name: event.file.name,
        id: event.file.id,
        exception: e,
      });
      return;
    }
    this.logger.info('Extracted progress summary', {
      ...extracted,
      report: event.report.id,
      userId: event.session.userId,
      fileId: event.file.id,
    });

    if (extracted?.cumulative) {
      await this.repo.save(
        event.report,
        SummaryPeriod.Cumulative,
        extracted.cumulative,
      );
    }
    if (extracted?.reportPeriod) {
      await this.repo.save(
        event.report,
        SummaryPeriod.ReportPeriod,
        extracted.reportPeriod,
      );
    }
    if (extracted?.fiscalYear) {
      await this.repo.save(
        event.report,
        SummaryPeriod.FiscalYearSoFar,
        extracted.fiscalYear,
      );
    }
  }
}
