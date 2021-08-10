import { fiscalQuarter, fiscalYear as getFiscalYear } from '../../../common';
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

    const workbook = await this.extractor.readWorkbook(event.file);

    const cumulative = this.extractor.extractCumulative(
      workbook,
      event.file,
      getFiscalYear(event.report.start)
    );
    if (cumulative) {
      await this.repo.save(event.report, SummaryPeriod.Cumulative, cumulative);
    }

    const period = this.extractor.extractReportPeriod(
      workbook,
      event.file,
      fiscalQuarter(event.report.start),
      getFiscalYear(event.report.start)
    );
    if (period) {
      await this.repo.save(event.report, SummaryPeriod.ReportPeriod, period);
    }

    const fiscalYear = this.extractor.extractFiscalYear(
      workbook,
      event.file,
      getFiscalYear(event.report.start)
    );
    if (fiscalYear) {
      await this.repo.save(
        event.report,
        SummaryPeriod.FiscalYearSoFar,
        fiscalYear
      );
    }
  }
}
