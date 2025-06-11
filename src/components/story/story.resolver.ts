import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { type ID, IdArg, ListArg } from '~/common';
import { Loader, type LoaderOf } from '~/core';
import {
  CreateStoryInput,
  CreateStoryOutput,
  DeleteStoryOutput,
  Story,
  StoryListInput,
  StoryListOutput,
  UpdateStoryInput,
  UpdateStoryOutput,
} from './dto';
import { StoryLoader } from './story.loader';
import { StoryService } from './story.service';

@Resolver(Story)
export class StoryResolver {
  constructor(private readonly storyService: StoryService) {}

  @Query(() => Story, {
    description: 'Look up a story by its ID',
  })
  async story(
    @Loader(StoryLoader) stories: LoaderOf<StoryLoader>,
    @IdArg() id: ID,
  ): Promise<Story> {
    return await stories.load(id);
  }

  @Query(() => StoryListOutput, {
    description: 'Look up stories',
  })
  async stories(
    @ListArg(StoryListInput) input: StoryListInput,
    @Loader(StoryLoader) stories: LoaderOf<StoryLoader>,
  ): Promise<StoryListOutput> {
    const list = await this.storyService.list(input);
    stories.primeAll(list.items);
    return list;
  }

  @Mutation(() => CreateStoryOutput, {
    description: 'Create a story',
  })
  async createStory(@Args('input') { story: input }: CreateStoryInput): Promise<CreateStoryOutput> {
    const story = await this.storyService.create(input);
    return { story };
  }

  @Mutation(() => UpdateStoryOutput, {
    description: 'Update a story',
  })
  async updateStory(@Args('input') { story: input }: UpdateStoryInput): Promise<UpdateStoryOutput> {
    const story = await this.storyService.update(input);
    return { story };
  }

  @Mutation(() => DeleteStoryOutput, {
    description: 'Delete a story',
  })
  async deleteStory(@IdArg() id: ID): Promise<DeleteStoryOutput> {
    await this.storyService.delete(id);
    return { success: true };
  }
}
