import { Module } from '@nestjs/common';
import { DimensionsResolver } from './dimensions.resolver';
import { MediaLoader } from './media.loader';
import { MediaRepository } from './media.repository';
import { MediaResolver } from './media.resolver';

@Module({
  providers: [
    DimensionsResolver,
    MediaLoader,
    MediaRepository,
    MediaResolver,
    // multiple
  ],
})
export class MediaModule {}
