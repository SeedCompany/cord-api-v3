import { type ID } from '~/common';
import {
  type DataLoaderStrategy,
  LoaderFactory,
  type LoaderOptionsOf,
} from '~/core/data-loader';
import { type ProgressReport } from '../dto';
import { type ProgressReportVarianceExplanation as VarianceExplanation } from './variance-explanation.dto';
import { ProgressReportVarianceExplanationService } from './variance-explanation.service';

@LoaderFactory()
export class ProgressReportVarianceExplanationLoader
  implements DataLoaderStrategy<VarianceExplanation, ProgressReport, ID>
{
  constructor(
    private readonly service: ProgressReportVarianceExplanationService,
  ) {}

  getOptions() {
    return {
      propertyKey: (obj) => obj.report,
      cacheKeyFn: (key) => key.id,
    } satisfies LoaderOptionsOf<ProgressReportVarianceExplanationLoader, ID>;
  }

  async loadMany(reports: readonly ProgressReport[]) {
    return await this.service.readMany(reports);
  }
}
