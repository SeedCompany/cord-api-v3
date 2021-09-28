import { Injectable, Scope } from '@nestjs/common';
import { ID } from '../../common';
import { OrderedNestDataLoader } from '../../core';
import { Story } from './dto';
import { StoryService } from './story.service';

@Injectable({ scope: Scope.REQUEST })
export class StoryLoader extends OrderedNestDataLoader<Story> {
  constructor(private readonly stories: StoryService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.stories.readMany(ids, this.session);
  }
}
