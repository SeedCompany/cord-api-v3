import { Module } from '@nestjs/common';
import { DetectExistingMediaMigration } from './detect-existing-media.migration';
import { DimensionsResolver } from './dimensions.resolver';
import { MediaByFileVersionLoader } from './media-by-file-version.loader';
import { MediaDetector } from './media-detector.service';
import { MediaLoader } from './media.loader';
import { MediaRepository } from './media.repository';
import { MediaResolver } from './media.resolver';
import { MediaService } from './media.service';

@Module({
  providers: [
    DimensionsResolver,
    MediaByFileVersionLoader,
    MediaDetector,
    MediaLoader,
    MediaRepository,
    MediaResolver,
    MediaService,
    DetectExistingMediaMigration,
  ],
  exports: [MediaService],
})
export class MediaModule {}
