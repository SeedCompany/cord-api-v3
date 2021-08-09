import { EventsHandler } from '../../../core';
import { ReportType } from '../../periodic-report/dto';
import { PeriodicReportUploadedEvent } from '../../periodic-report/events';
import { SummaryPeriod } from '../dto';
import { ProgressExtractor } from '../progress-extractor.service';
import { ProgressSummaryRepository } from '../progress-summary.repository';

@EventsHandler(PeriodicReportUploadedEvent)
export class ExtractPnpFileOnUploadHandler {
  constructor(
    private readonly repo: ProgressSummaryRepository,
    private readonly extractor: ProgressExtractor
  ) {}

  async handle(event: PeriodicReportUploadedEvent) {
    if (event.report.type !== ReportType.Progress) {
      return;
    }

    const summary = await this.extractor.extract(event.file);
    if (!summary) {
      return; // error already logged
    }

    await this.repo.save(event.report, SummaryPeriod.Cumulative, summary);
  }
}
