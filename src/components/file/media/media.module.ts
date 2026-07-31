import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { FileModule } from '../file.module';
import { DetectExistingMediaMigration } from './detect-existing-media.migration';
import { DimensionsResolver } from './dimensions.resolver';
import { CanUpdateMediaUserMetadataHook } from './hooks/can-update.hook';
import { MediaByFileVersionLoader } from './media-by-file-version.loader';
import { MediaDetector } from './media-detector.service';
import { MediaDrizzleRepository } from './media.drizzle.repository';
import { MediaLoader } from './media.loader';
import { MediaRepository } from './media.repository';
import { MediaResolver } from './media.resolver';
import { MediaService } from './media.service';

@Module({
  imports: [forwardRef(() => FileModule)],
  providers: [
    DimensionsResolver,
    MediaByFileVersionLoader,
    MediaDetector,
    MediaLoader,
    // migration-todo: drop the `as any` + the Neo4j path at Phase 7 cutover.
    splitDb(MediaRepository, {
      postgres: MediaDrizzleRepository as any,
    }),
    MediaResolver,
    MediaService,
    DetectExistingMediaMigration,
    CanUpdateMediaUserMetadataHook,
  ],
  exports: [MediaService],
})
export class MediaModule {}
