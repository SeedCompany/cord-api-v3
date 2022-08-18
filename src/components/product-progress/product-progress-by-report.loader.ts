import { ID } from '../../common';
import {
  LoaderFactory,
  LoaderOptionsOf,
  OrderedNestDataLoader,
} from '../../core';
import { ProgressReport } from '../periodic-report';
import { ProductProgress } from './dto';
import { ProductProgressService } from './product-progress.service';

@LoaderFactory()
export class ProductProgressByReportLoader extends OrderedNestDataLoader<
  { report: ProgressReport; progress: readonly ProductProgress[] },
  ProgressReport,
  ID
> {
  constructor(private readonly service: ProductProgressService) {
    super();
  }

  getOptions(): LoaderOptionsOf<ProductProgressByReportLoader> {
    return {
      ...super.getOptions(),
      propertyKey: (result) => result.report,
      cacheKeyFn: (report) => report.id,
    };
  }

  async loadMany(reports: readonly ProgressReport[]) {
    return await this.service.readAllForManyReports(reports, this.session);
  }
}
