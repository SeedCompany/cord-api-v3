import { Injectable } from '@nestjs/common';
import {
  DuplicateException,
  ID,
  NotFoundException,
  ObjectView,
  ServerException,
  Session,
  UnauthorizedException,
  UnsecuredDto,
} from '../../common';
import { HandleIdLookup, ILogger, Logger } from '../../core';
import { mapListResults } from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { ScriptureReferenceService } from '../scripture/scripture-reference.service';
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
    private readonly scriptureRefService: ScriptureReferenceService,
    private readonly authorizationService: AuthorizationService,
    private readonly repo: StoryRepository
  ) {}

  async create(input: CreateStory, session: Session): Promise<Story> {
    const checkStory = await this.repo.checkStory(input.name);

    if (checkStory) {
      throw new DuplicateException(
        'story.name',
        'Story with this name already exists.'
      );
    }

    try {
      const result = await this.repo.create(input, session);

      if (!result) {
        throw new ServerException('failed to create a story');
      }

      await this.authorizationService.processNewBaseNode(
        Story,
        result.id,
        session.userId
      );

      await this.scriptureRefService.create(
        result.id,
        input.scriptureReferences,
        session
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

  private async secure(
    dto: UnsecuredDto<Story>,
    session: Session
  ): Promise<Story> {
    const securedProps = await this.authorizationService.secureProperties(
      Story,
      dto,
      session
    );

    const scriptureReferences = await this.scriptureRefService.list(
      dto.id,
      session
    );
    return {
      ...dto,
      ...securedProps,
      scriptureReferences: {
        ...securedProps.scriptureReferences,
        value: scriptureReferences,
      },
      canDelete: await this.repo.checkDeletePermission(dto.id, session),
    };
  }

  async update(input: UpdateStory, session: Session): Promise<Story> {
    const story = await this.readOne(input.id, session);
    const changes = this.repo.getActualChanges(story, input);
    await this.authorizationService.verifyCanEditChanges(Story, story, changes);
    const { scriptureReferences, ...simpleChanges } = changes;

    await this.scriptureRefService.update(input.id, scriptureReferences);
    await this.repo.updateProperties(story, simpleChanges);

    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const story = await this.readOne(id, session);
    if (!story) {
      throw new NotFoundException('Could not find Story');
    }
    const canDelete = await this.repo.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Story'
      );

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
    session: Session
  ): Promise<StoryListOutput> {
    const results = await this.repo.list(input, session);
    return await mapListResults(results, (dto) => this.secure(dto, session));
  }
}
