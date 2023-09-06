import { IdOf } from '~/common';
import { LoaderFactory, SessionAwareLoaderStrategy } from '~/core';
import { ProgressReportMedia as ReportMedia } from './media.dto';
import { ProgressReportMediaService } from './progress-report-media.service';

@LoaderFactory(() => ReportMedia)
export class ProgressReportMediaLoader extends SessionAwareLoaderStrategy<
  ReportMedia,
  IdOf<ReportMedia>
> {
  constructor(private readonly service: ProgressReportMediaService) {
    super();
  }

  async loadMany(ids: ReadonlyArray<IdOf<ReportMedia>>) {
    return await this.service.readMany(ids, this.session);
  }
}
