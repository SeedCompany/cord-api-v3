import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { ProgressReport } from '../progress-report/dto';
import {
  FinancialReport,
  IPeriodicReport,
  NarrativeReport,
  type PeriodicReport,
} from './dto';
import { PeriodicReportService } from './periodic-report.service';

@LoaderFactory(() => [
  IPeriodicReport,
  FinancialReport,
  NarrativeReport,
  ProgressReport,
])
export class PeriodicReportLoader
  implements DataLoaderStrategy<PeriodicReport, ID<IPeriodicReport>>
{
  constructor(private readonly periodicReports: PeriodicReportService) {}

  async loadMany(ids: ReadonlyArray<ID<IPeriodicReport>>) {
    return await this.periodicReports.readMany(ids);
  }
}
