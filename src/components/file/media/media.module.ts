import { Module } from '@nestjs/common';
import { DimensionsResolver } from './dimensions.resolver';
import { MediaResolver } from './media.resolver';

@Module({
  providers: [
    DimensionsResolver,
    MediaResolver,
    // multiple
  ],
})
export class MediaModule {}
