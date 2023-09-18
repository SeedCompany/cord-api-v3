import { forwardRef, Module } from '@nestjs/common';
import { FileModule } from '../file.module';
import { DetectExistingMediaMigration } from './detect-existing-media.migration';
import { DimensionsResolver } from './dimensions.resolver';
import { CanUpdateMediaUserMetadataEvent } from './events/can-update-event';
import { MediaByFileVersionLoader } from './media-by-file-version.loader';
import { MediaDetector } from './media-detector.service';
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
    MediaRepository,
    MediaResolver,
    MediaService,
    DetectExistingMediaMigration,
    CanUpdateMediaUserMetadataEvent,
  ],
  exports: [MediaService],
})
export class MediaModule {}
