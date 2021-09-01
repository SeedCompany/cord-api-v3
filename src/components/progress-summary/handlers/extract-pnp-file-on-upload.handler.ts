import { EventsHandler } from '../../../core';
import { PnpProgressUploadedEvent } from '../../periodic-report/events';
import { SummaryPeriod } from '../dto';
import { ProgressExtractor } from '../progress-extractor.service';
import { ProgressSummaryRepository } from '../progress-summary.repository';

@EventsHandler(PnpProgressUploadedEvent)
export class ExtractPnpFileOnUploadHandler {
  constructor(
    private readonly repo: ProgressSummaryRepository,
    private readonly extractor: ProgressExtractor
  ) {}

  async handle(event: PnpProgressUploadedEvent) {
    const workbook = await this.extractor.readWorkbook(event.file);

    const extracted = this.extractor.extract(
      workbook,
      event.file,
      event.report.start
    );
    if (extracted?.cumulative) {
      await this.repo.save(
        event.report,
        SummaryPeriod.Cumulative,
        extracted.cumulative
      );
    }
    if (extracted?.reportPeriod) {
      await this.repo.save(
        event.report,
        SummaryPeriod.ReportPeriod,
        extracted.reportPeriod
      );
    }
    if (extracted?.fiscalYear) {
      await this.repo.save(
        event.report,
        SummaryPeriod.FiscalYearSoFar,
        extracted.fiscalYear
      );
    }
  }
}
