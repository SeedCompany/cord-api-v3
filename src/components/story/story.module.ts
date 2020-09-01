import { Module } from '@nestjs/common';
import { ScriptureModule } from '../scripture/scripture.module';
import { StoryResolver } from './story.resolver';
import { StoryService } from './story.service';

@Module({
  imports: [ScriptureModule],
  providers: [StoryResolver, StoryService],
  exports: [StoryService],
})
export class StoryModule {}
