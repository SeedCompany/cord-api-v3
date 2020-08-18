import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IdArg, ISession, Session } from '../../common';
import {
  CreateStoryInput,
  CreateStoryOutput,
  Story,
  StoryListInput,
  StoryListOutput,
  UpdateStoryInput,
  UpdateStoryOutput,
} from './dto';
import { StoryService } from './story.service';

@Resolver(Story)
export class StoryResolver {
  constructor(private readonly storyService: StoryService) {}

  @Query(() => Story, {
    description: 'Look up a story by its ID',
  })
  async story(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<Story> {
    return await this.storyService.readOne(id, session);
  }

  @Query(() => StoryListOutput, {
    description: 'Look up stories',
  })
  async stories(
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => StoryListInput,
      defaultValue: StoryListInput.defaultVal,
    })
    input: StoryListInput
  ): Promise<StoryListOutput> {
    return this.storyService.list(input, session);
  }

  @Mutation(() => CreateStoryOutput, {
    description: 'Create a story',
  })
  async createStory(
    @Session() session: ISession,
    @Args('input') { story: input }: CreateStoryInput
  ): Promise<CreateStoryOutput> {
    const story = await this.storyService.create(input, session);
    return { story };
  }

  @Mutation(() => UpdateStoryOutput, {
    description: 'Update a story',
  })
  async updateStory(
    @Session() session: ISession,
    @Args('input') { story: input }: UpdateStoryInput
  ): Promise<UpdateStoryOutput> {
    const story = await this.storyService.update(input, session);
    return { story };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a story',
  })
  async deleteStory(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<boolean> {
    await this.storyService.delete(id, session);
    return true;
  }
}
