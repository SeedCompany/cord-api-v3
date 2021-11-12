import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AnonSession, ID, IdArg, LoggedInSession, Session } from '../../common';
import { Loader, LoaderOf } from '../../core';
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
    @IdArg() id: ID
  ): Promise<Story> {
    return await stories.load(id);
  }

  @Query(() => StoryListOutput, {
    description: 'Look up stories',
  })
  async stories(
    @AnonSession() session: Session,
    @Args({
      name: 'input',
      type: () => StoryListInput,
      defaultValue: StoryListInput.defaultVal,
    })
    input: StoryListInput,
    @Loader(StoryLoader) stories: LoaderOf<StoryLoader>
  ): Promise<StoryListOutput> {
    const list = await this.storyService.list(input, session);
    stories.primeAll(list.items);
    return list;
  }

  @Mutation(() => CreateStoryOutput, {
    description: 'Create a story',
  })
  async createStory(
    @LoggedInSession() session: Session,
    @Args('input') { story: input }: CreateStoryInput
  ): Promise<CreateStoryOutput> {
    const story = await this.storyService.create(input, session);
    return { story };
  }

  @Mutation(() => UpdateStoryOutput, {
    description: 'Update a story',
  })
  async updateStory(
    @LoggedInSession() session: Session,
    @Args('input') { story: input }: UpdateStoryInput
  ): Promise<UpdateStoryOutput> {
    const story = await this.storyService.update(input, session);
    return { story };
  }

  @Mutation(() => DeleteStoryOutput, {
    description: 'Delete a story',
  })
  async deleteStory(
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<DeleteStoryOutput> {
    await this.storyService.delete(id, session);
    return { success: true };
  }
}
