import { Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { FileModule } from '../../file/file.module';
import { ProgressReportMediaFileIsMediaCheckHandler } from './handlers/file-is-media-check.handler';
import { ProgressReportUpdateMediaMetadataCheckHandler } from './handlers/update-media-metadata-check.handler';
import { ProgressReportFeaturedMediaLoader } from './progress-report-featured-media.loader';
import { ProgressReportMediaDrizzleRepository } from './progress-report-media.drizzle.repository';
import { ProgressReportMediaLoader } from './progress-report-media.loader';
import { ProgressReportMediaRepository } from './progress-report-media.repository';
import { ProgressReportMediaService } from './progress-report-media.service';
import { ProgressReportMediaListResolver } from './resolvers/list.resolver';
import { ProgressReportMediaResolver } from './resolvers/media.resolver';
import { ProgressReportMediaProgressReportConnectionResolver } from './resolvers/report-connection.resolver';

@Module({
  imports: [FileModule],
  exports: [ProgressReportMediaService],
  providers: [
    ProgressReportMediaResolver,
    ProgressReportMediaListResolver,
    ProgressReportMediaProgressReportConnectionResolver,
    ProgressReportMediaLoader,
    ProgressReportFeaturedMediaLoader,
    ProgressReportMediaService,
    // migration-todo: drop the `as any` + the Neo4j path at Phase 7 cutover.
    splitDb(ProgressReportMediaRepository, {
      postgres: ProgressReportMediaDrizzleRepository as any,
    }),
    ProgressReportUpdateMediaMetadataCheckHandler,
    ProgressReportMediaFileIsMediaCheckHandler,
  ],
})
export class ProgressReportMediaModule {}
