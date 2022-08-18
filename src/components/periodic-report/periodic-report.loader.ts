import { ID } from '../../common';
import { LoaderFactory, OrderedNestDataLoader } from '../../core';
import {
  FinancialReport,
  IPeriodicReport,
  NarrativeReport,
  PeriodicReport,
  ProgressReport,
} from './dto';
import { PeriodicReportService } from './periodic-report.service';

@LoaderFactory(() => [
  IPeriodicReport,
  FinancialReport,
  NarrativeReport,
  ProgressReport,
])
export class PeriodicReportLoader extends OrderedNestDataLoader<PeriodicReport> {
  constructor(private readonly periodicReports: PeriodicReportService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.periodicReports.readMany(ids, this.session);
  }
}
