import { Module } from '@nestjs/common';
import { DimensionsResolver } from './dimensions.resolver';
import { MediaByFileVersionLoader } from './media-by-file-version.loader';
import { MediaLoader } from './media.loader';
import { MediaRepository } from './media.repository';
import { MediaResolver } from './media.resolver';

@Module({
  providers: [
    DimensionsResolver,
    MediaByFileVersionLoader,
    MediaLoader,
    MediaRepository,
    MediaResolver,
    // multiple
  ],
})
export class MediaModule {}
