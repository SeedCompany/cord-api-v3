import { forwardRef, Inject } from '@nestjs/common';
import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { ProgressReportMedia as ReportMedia } from './dto';
import { ProgressReportMediaService } from './progress-report-media.service';

@LoaderFactory(() => ReportMedia)
export class ProgressReportMediaLoader implements DataLoaderStrategy<ReportMedia, ID<ReportMedia>> {
  constructor(
    @Inject(forwardRef(() => ProgressReportMediaService))
    private readonly service: ProgressReportMediaService & {},
  ) {}

  async loadMany(ids: ReadonlyArray<ID<ReportMedia>>) {
    return await this.service.readMany(ids);
  }
}
