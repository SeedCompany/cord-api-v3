import { Injectable } from '@nestjs/common';
import {
  type ID,
  type ObjectView,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { HandleIdLookup } from '~/core';
import { ifDiff } from '~/core/database/changes';
import { Privileges } from '../authorization';
import { isScriptureEqual } from '../scripture';
import {
  type CreateStory,
  Story,
  type StoryListInput,
  type StoryListOutput,
  type UpdateStory,
} from './dto';
import { StoryRepository } from './story.repository';

@Injectable()
export class StoryService {
  constructor(
    private readonly privileges: Privileges,
    private readonly repo: StoryRepository,
  ) {}

  async create(input: CreateStory): Promise<Story> {
    const dto = await this.repo.create(input);
    this.privileges.for(Story, dto).verifyCan('create');
    return this.secure(dto);
  }

  @HandleIdLookup(Story)
  async readOne(id: ID, _view?: ObjectView): Promise<Story> {
    const result = await this.repo.readOne(id);
    return this.secure(result);
  }

  async readMany(ids: readonly ID[]) {
    const stories = await this.repo.readMany(ids);
    return stories.map((dto) => this.secure(dto));
  }

  private secure(dto: UnsecuredDto<Story>): Story {
    return this.privileges.for(Story).secure(dto);
  }

  async update(input: UpdateStory): Promise<Story> {
    const story = await this.repo.readOne(input.id);
    const changes = {
      ...this.repo.getActualChanges(story, input),
      scriptureReferences: ifDiff(isScriptureEqual)(
        input.scriptureReferences,
        story.scriptureReferences,
      ),
    };
    this.privileges.for(Story, story).verifyChanges(changes);

    const updated = await this.repo.update({ id: input.id, ...changes });
    return this.secure(updated);
  }

  async delete(id: ID): Promise<void> {
    const story = await this.repo.readOne(id);

    this.privileges.for(Story, story).verifyCan('delete');

    try {
      await this.repo.deleteNode(story);
    } catch (exception) {
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(input: StoryListInput): Promise<StoryListOutput> {
    const results = await this.repo.list(input);
    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto)),
    };
  }
}
