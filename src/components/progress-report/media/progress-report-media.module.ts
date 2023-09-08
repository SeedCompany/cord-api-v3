import { Module } from '@nestjs/common';
import { FileModule } from '../../file/file.module';
import { ProgressReportMediaFileIsMediaCheckHandler } from './handlers/file-is-media-check.handler';
import { ProgressReportUpdateMediaMetadataCheckHandler } from './handlers/update-media-metadata-check.handler';
import { ProgressReportMediaLoader } from './progress-report-media.loader';
import { ProgressReportMediaRepository } from './progress-report-media.repository';
import {
  ProgressReportMediaActionsResolver,
  ProgressReportMediaListResolver,
  ProgressReportMediaProgressReportConnectionResolver,
  ProgressReportMediaResolver,
} from './progress-report-media.resolver';
import { ProgressReportMediaService } from './progress-report-media.service';

@Module({
  imports: [FileModule],
  providers: [
    ProgressReportMediaResolver,
    ProgressReportMediaListResolver,
    ProgressReportMediaProgressReportConnectionResolver,
    ProgressReportMediaActionsResolver,
    ProgressReportMediaLoader,
    ProgressReportMediaService,
    ProgressReportMediaRepository,
    ProgressReportUpdateMediaMetadataCheckHandler,
    ProgressReportMediaFileIsMediaCheckHandler,
  ],
})
export class ProgressReportMediaModule {}
