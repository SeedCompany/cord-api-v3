import { ID } from '~/common';
import { LoaderFactory, LoaderOptionsOf, OrderedNestDataLoader } from '~/core';
import { ProgressReport } from '../dto';
import { ProgressReportVarianceExplanation as VarianceExplanation } from './variance-explanation.dto';
import { ProgressReportVarianceExplanationService } from './variance-explanation.service';

@LoaderFactory()
export class ProgressReportVarianceExplanationLoader extends OrderedNestDataLoader<
  VarianceExplanation,
  ProgressReport,
  ID
> {
  constructor(
    private readonly service: ProgressReportVarianceExplanationService,
  ) {
    super();
  }

  getOptions(): LoaderOptionsOf<ProgressReportVarianceExplanationLoader> {
    return {
      ...super.getOptions(),
      propertyKey: (obj) => obj.report,
      cacheKeyFn: (key) => key.id,
    };
  }

  async loadMany(reports: readonly ProgressReport[]) {
    return await this.service.readMany(reports, this.session);
  }
}
