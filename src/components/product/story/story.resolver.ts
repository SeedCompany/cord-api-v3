import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IdArg, ISession, Session } from '../../../common';
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

@Resolver(Story.classType)
export class StoryResolver {
  constructor(private readonly storyService: StoryService) {}

  @Mutation(() => CreateStoryOutput, {
    description: 'Create an story',
  })
  async createStory(
    @Session() session: ISession,
    @Args('input') { story: input }: CreateStoryInput
  ): Promise<CreateStoryOutput> {
    const story = await this.storyService.create(input, session);
    return { story };
  }

  @Query(() => Story, {
    description: 'Look up an story by its ID',
  })
  async story(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<Story> {
    return this.storyService.readOne(id, session);
  }

  @Query(() => StoryListOutput, {
    description: 'Look up storys',
  })
  async storys(
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

  @Mutation(() => UpdateStoryOutput, {
    description: 'Update an story',
  })
  async updateStory(
    @Session() session: ISession,
    @Args('input') { story: input }: UpdateStoryInput
  ): Promise<UpdateStoryOutput> {
    const story = await this.storyService.update(input, session);
    return { story };
  }

  @Mutation(() => Boolean, {
    description: 'Delete an story',
  })
  async deleteStory(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<boolean> {
    await this.storyService.delete(id, session);
    return true;
  }
}
