import {
  type DataLoaderStrategy,
  LoaderFactory,
  type LoaderOptionsOf,
} from '~/core/data-loader';
import {
  type MediaReportId,
  type ProgressReportMedia as ReportMedia,
} from './dto';
import { ProgressReportMediaService } from './progress-report-media.service';

/** Keyed by the report id — a ProgressReport or a GTLReport. */
@LoaderFactory()
export class ProgressReportFeaturedMediaLoader implements DataLoaderStrategy<
  ReportMedia,
  MediaReportId
> {
  constructor(private readonly service: ProgressReportMediaService) {}

  getOptions() {
    return {
      propertyKey: 'report',
    } satisfies LoaderOptionsOf<ProgressReportFeaturedMediaLoader>;
  }

  async loadMany(ids: readonly MediaReportId[]) {
    return await this.service.readFeaturedOfReport(ids);
  }
}
