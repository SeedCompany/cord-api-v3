import { type ID } from '~/common';
import {
  type DataLoaderStrategy,
  LoaderFactory,
  type LoaderOptionsOf,
} from '~/core/data-loader';
import { type ProgressReport } from '../dto';
import { type ProgressReportMedia as ReportMedia } from './dto';
import { ProgressReportMediaService } from './progress-report-media.service';

@LoaderFactory()
export class ProgressReportFeaturedMediaLoader implements DataLoaderStrategy<
  ReportMedia,
  ID<ProgressReport>
> {
  constructor(private readonly service: ProgressReportMediaService) {}

  getOptions() {
    return {
      propertyKey: 'report',
    } satisfies LoaderOptionsOf<ProgressReportFeaturedMediaLoader>;
  }

  async loadMany(ids: ReadonlyArray<ID<ProgressReport>>) {
    return await this.service.readFeaturedOfReport(ids);
  }
}
