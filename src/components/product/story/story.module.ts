import { Module } from '@nestjs/common';
import { RangeModule } from '../range';
import { StoryResolver } from './story.resolver';
import { StoryService } from './story.service';

@Module({
  imports: [RangeModule],
  providers: [StoryResolver, StoryService],
  exports: [StoryService],
})
export class StoryModule {}
