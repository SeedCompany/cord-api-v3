import { Injectable } from '@nestjs/common';
import {
  DuplicateException,
  ID,
  ObjectView,
  ServerException,
  Session,
} from '~/common';
import { DbTypeOf, HandleIdLookup, ILogger, Logger } from '~/core';
import { ifDiff } from '~/core/database/changes';
import { mapListResults } from '~/core/database/results';
import { Privileges } from '../authorization';
import { isScriptureEqual, ScriptureReferenceService } from '../scripture';
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
    @Logger('story:service') private readonly logger: ILogger,
    private readonly scriptureRefs: ScriptureReferenceService,
    private readonly privileges: Privileges,
    private readonly repo: StoryRepository,
  ) {}

  async create(input: CreateStory, session: Session): Promise<Story> {
    this.privileges.for(session, Story).verifyCan('create');
    if (!(await this.repo.isUnique(input.name))) {
      throw new DuplicateException(
        'story.name',
        'Story with this name already exists.',
      );
    }

    try {
      const result = await this.repo.create(input, session);

      if (!result) {
        throw new ServerException('failed to create a story');
      }

      await this.scriptureRefs.create(
        result.id,
        input.scriptureReferences,
        session,
      );

      this.logger.debug(`story created`, { id: result.id });
      return await this.readOne(result.id, session);
    } catch (exception) {
      this.logger.error(`Could not create story`, {
        exception,
        userId: session.userId,
      });
      throw new ServerException('Could not create story', exception);
    }
  }

  @HandleIdLookup(Story)
  async readOne(id: ID, session: Session, _view?: ObjectView): Promise<Story> {
    this.logger.debug(`Read Story`, {
      id,
      userId: session.userId,
    });

    const result = await this.repo.readOne(id);
    return await this.secure(result, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const stories = await this.repo.readMany(ids);
    return await Promise.all(stories.map((dto) => this.secure(dto, session)));
  }

  private async secure(dto: DbTypeOf<Story>, session: Session): Promise<Story> {
    return this.privileges.for(session, Story).secure({
      ...dto,
      scriptureReferences: this.scriptureRefs.parseList(
        dto.scriptureReferences,
      ),
    });
  }

  async update(input: UpdateStory, session: Session): Promise<Story> {
    const story = await this.readOne(input.id, session);
    const changes = {
      ...this.repo.getActualChanges(story, input),
      scriptureReferences: ifDiff(isScriptureEqual)(
        input.scriptureReferences,
        story.scriptureReferences.value,
      ),
    };
    this.privileges.for(session, Story, story).verifyChanges(changes);
    const { scriptureReferences, ...simpleChanges } = changes;

    await this.scriptureRefs.update(input.id, scriptureReferences);
    await this.repo.update(story, simpleChanges);

    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const story = await this.readOne(id, session);

    this.privileges.for(session, Story, story).verifyCan('delete');

    try {
      await this.repo.deleteNode(story);
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }

    this.logger.debug(`deleted story with id`, { id });
  }

  async list(
    input: StoryListInput,
    session: Session,
  ): Promise<StoryListOutput> {
    const results = await this.repo.list(input, session);
    return await mapListResults(results, (dto) => this.secure(dto, session));
  }
}
