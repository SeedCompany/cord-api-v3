import { LoaderFactory, LoaderOptionsOf, OrderedNestDataLoader } from '~/core';
import {
  ProgressVariantByReportInput,
  ProgressVariantByReportOutput,
} from './dto';
import { ProductProgressService } from './product-progress.service';

@LoaderFactory()
export class ProductProgressByReportLoader extends OrderedNestDataLoader<
  ProgressVariantByReportOutput,
  ProgressVariantByReportInput,
  string
> {
  constructor(private readonly service: ProductProgressService) {
    super();
  }

  getOptions() {
    return {
      propertyKey: (result) => ({
        report: result.report,
        variant: result.variant,
      }),
      cacheKeyFn: (args) => `${args.report.id}:${args.variant.key}`,
    } satisfies LoaderOptionsOf<ProductProgressByReportLoader>;
  }

  async loadMany(reports: readonly ProgressVariantByReportInput[]) {
    return await this.service.readAllForManyReports(reports, this.session);
  }
}
