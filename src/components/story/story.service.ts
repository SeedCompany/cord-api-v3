import { Injectable } from '@nestjs/common';
import {
  ID,
  ObjectView,
  ServerException,
  Session,
  UnsecuredDto,
} from '~/common';
import { HandleIdLookup } from '~/core';
import { ifDiff } from '~/core/database/changes';
import { Privileges } from '../authorization';
import { isScriptureEqual } from '../scripture';
import {
  CreateStory,
  Story,
  StoryListInput,
  StoryListOutput,
  UpdateStory,
} from './dto';
import { StoryRepository } from './story.repository';

@Injectable()
export class StoryService {
  constructor(
    private readonly privileges: Privileges,
    private readonly repo: StoryRepository,
  ) {}

  async create(input: CreateStory, session: Session): Promise<Story> {
    const dto = await this.repo.create(input, session);
    this.privileges.for(session, Story, dto).verifyCan('create');
    return this.secure(dto, session);
  }

  @HandleIdLookup(Story)
  async readOne(id: ID, session: Session, _view?: ObjectView): Promise<Story> {
    const result = await this.repo.readOne(id);
    return this.secure(result, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const stories = await this.repo.readMany(ids);
    return stories.map((dto) => this.secure(dto, session));
  }

  private secure(dto: UnsecuredDto<Story>, session: Session): Story {
    return this.privileges.for(session, Story).secure(dto);
  }

  async update(input: UpdateStory, session: Session): Promise<Story> {
    const story = await this.repo.readOne(input.id);
    const changes = {
      ...this.repo.getActualChanges(story, input),
      scriptureReferences: ifDiff(isScriptureEqual)(
        input.scriptureReferences,
        story.scriptureReferences,
      ),
    };
    this.privileges.for(session, Story, story).verifyChanges(changes);

    const updated = await this.repo.update({ id: input.id, ...changes });
    return this.secure(updated, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const story = await this.repo.readOne(id);

    this.privileges.for(session, Story, story).verifyCan('delete');

    try {
      await this.repo.deleteNode(story);
    } catch (exception) {
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(
    input: StoryListInput,
    session: Session,
  ): Promise<StoryListOutput> {
    const results = await this.repo.list(input);
    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto, session)),
    };
  }
}
