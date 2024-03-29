import { DataLoaderOptions } from '@seedcompany/data-loader';
import { IdOf } from '~/common';
import { LoaderFactory, SessionAwareLoaderStrategy } from '~/core';
import { ProgressReport } from '../dto';
import { ProgressReportMedia as ReportMedia } from './dto';
import { ProgressReportMediaService } from './progress-report-media.service';

@LoaderFactory()
export class ProgressReportFeaturedMediaLoader extends SessionAwareLoaderStrategy<
  ReportMedia,
  IdOf<ProgressReport>
> {
  constructor(private readonly service: ProgressReportMediaService) {
    super();
  }

  getOptions(): DataLoaderOptions<ReportMedia, IdOf<ProgressReport>> {
    return {
      propertyKey: 'report',
    };
  }

  async loadMany(ids: ReadonlyArray<IdOf<ProgressReport>>) {
    return await this.service.readFeaturedOfReport(ids, this.session);
  }
}
