import { EventsHandler } from '../../../core';
import { ReportType } from '../../periodic-report/dto';
import { PeriodicReportUploadedEvent } from '../../periodic-report/events';
import { ProgressSummary } from '../dto';
import { ProgressSummaryRepository } from '../progress-summary.repository';

@EventsHandler(PeriodicReportUploadedEvent)
export class ExtractPnpFileOnUploadHandler {
  constructor(private readonly repo: ProgressSummaryRepository) {}

  async handle(event: PeriodicReportUploadedEvent) {
    if (event.report.type !== ReportType.Progress) {
      return;
    }

    const extracted: ProgressSummary | null = null; // TODO

    if (!extracted) {
      return; // error already logged
    }

    await this.repo.save(event.report, extracted);
  }
}
