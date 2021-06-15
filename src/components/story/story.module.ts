import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ScriptureModule } from '../scripture/scripture.module';
import { StoryRepository } from './story.repository';
import { StoryResolver } from './story.resolver';
import { StoryService } from './story.service';

@Module({
  imports: [forwardRef(() => AuthorizationModule), ScriptureModule],
  providers: [StoryResolver, StoryService, StoryRepository],
  exports: [StoryService],
})
export class StoryModule {}
