import { ID } from '../../common';
import { LoaderFactory, OrderedNestDataLoader } from '../../core';
import { Story } from './dto';
import { StoryService } from './story.service';

@LoaderFactory(() => Story)
export class StoryLoader extends OrderedNestDataLoader<Story> {
  constructor(private readonly stories: StoryService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.stories.readMany(ids, this.session);
  }
}
