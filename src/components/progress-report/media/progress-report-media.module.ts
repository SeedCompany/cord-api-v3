import { Module } from '@nestjs/common';
import { FileModule } from '../../file/file.module';
import { ProgressReportMediaFileIsMediaCheckHandler } from './handlers/file-is-media-check.handler';
import { ProgressReportUpdateMediaMetadataCheckHandler } from './handlers/update-media-metadata-check.handler';
import { ProgressReportFeaturedMediaLoader } from './progress-report-featured-media.loader';
import { ProgressReportMediaLoader } from './progress-report-media.loader';
import { ProgressReportMediaRepository } from './progress-report-media.repository';
import { ProgressReportMediaService } from './progress-report-media.service';
import { ProgressReportMediaListResolver } from './resolvers/list.resolver';
import { ProgressReportMediaResolver } from './resolvers/media.resolver';
import { ProgressReportMediaProgressReportConnectionResolver } from './resolvers/report-connection.resolver';

@Module({
  imports: [FileModule],
  providers: [
    ProgressReportMediaResolver,
    ProgressReportMediaListResolver,
    ProgressReportMediaProgressReportConnectionResolver,
    ProgressReportMediaLoader,
    ProgressReportFeaturedMediaLoader,
    ProgressReportMediaService,
    ProgressReportMediaRepository,
    ProgressReportUpdateMediaMetadataCheckHandler,
    ProgressReportMediaFileIsMediaCheckHandler,
  ],
})
export class ProgressReportMediaModule {}
