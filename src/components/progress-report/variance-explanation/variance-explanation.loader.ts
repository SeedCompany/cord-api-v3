import { type ID } from '~/common';
import {
  LoaderFactory,
  type LoaderOptionsOf,
  OrderedNestDataLoader,
} from '~/core';
import { type ProgressReport } from '../dto';
import { type ProgressReportVarianceExplanation as VarianceExplanation } from './variance-explanation.dto';
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
