import { EventsHandler } from '../../../core';
import { ReportType } from '../../periodic-report/dto';
import { PeriodicReportUploadedEvent } from '../../periodic-report/events';
import { StepProgressExtractor } from '../step-progress-extractor.service';

@EventsHandler(PeriodicReportUploadedEvent)
export class ExtractPnpFileOnUploadHandler {
  constructor(private readonly extractor: StepProgressExtractor) {}

  async handle(event: PeriodicReportUploadedEvent) {
    if (event.report.type !== ReportType.Progress) {
      return;
    }
    // eslint-disable-next-line @seedcompany/no-unused-vars
    const workbook = await this.extractor.readWorkbook(event.file);
  }
}
