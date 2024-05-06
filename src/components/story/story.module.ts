import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ScriptureModule } from '../scripture';
import { StoryEdgeDBRepository } from './story.edgedb.repository';
import { StoryLoader } from './story.loader';
import { StoryRepository } from './story.repository';
import { StoryResolver } from './story.resolver';
import { StoryService } from './story.service';

@Module({
  imports: [forwardRef(() => AuthorizationModule), ScriptureModule],
  providers: [
    StoryResolver,
    StoryService,
    splitDb(StoryRepository, StoryEdgeDBRepository),
    StoryLoader,
  ],
  exports: [StoryService],
})
export class StoryModule {}
