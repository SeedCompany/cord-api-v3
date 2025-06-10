import {
  type DataLoaderStrategy,
  LoaderFactory,
  type LoaderOptionsOf,
} from '~/core/data-loader';
import {
  type ProgressVariantByReportInput,
  type ProgressVariantByReportOutput,
} from './dto';
import { ProductProgressService } from './product-progress.service';

@LoaderFactory()
export class ProductProgressByReportLoader
  implements
    DataLoaderStrategy<
      ProgressVariantByReportOutput,
      ProgressVariantByReportInput,
      string
    >
{
  constructor(private readonly service: ProductProgressService) {}

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
    return await this.service.readAllForManyReports(reports);
  }
}
