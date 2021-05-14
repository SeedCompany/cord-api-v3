import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ScriptureModule } from '../scripture/scripture.module';
import { StoryResolver } from './story.resolver';
import { StoryService } from './story.service';
import { StoryRepository } from './story.repository';

@Module({
  imports: [forwardRef(() => AuthorizationModule), ScriptureModule],
  providers: [StoryResolver, StoryService, StoryRepository],
  exports: [StoryService, StoryRepository],
})
export class StoryModule {}
