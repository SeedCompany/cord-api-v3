import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { Story } from './dto';
import { StoryService } from './story.service';

@LoaderFactory(() => Story)
export class StoryLoader implements DataLoaderStrategy<Story, ID<Story>> {
  constructor(private readonly stories: StoryService) {}

  async loadMany(ids: ReadonlyArray<ID<Story>>) {
    return await this.stories.readMany(ids);
  }
}
