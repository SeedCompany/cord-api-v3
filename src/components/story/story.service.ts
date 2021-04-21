import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import {
  DuplicateException,
  generateId,
  ID,
  NotFoundException,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../common';
import {
  ConfigService,
  createBaseNode,
  DatabaseService,
  ILogger,
  Logger,
  matchRequestingUser,
  OnIndex,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  runListQuery,
  StandardReadResult,
} from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { ScriptureReferenceService } from '../scripture/scripture-reference.service';
import {
  CreateStory,
  Story,
  StoryListInput,
  StoryListOutput,
  UpdateStory,
} from './dto';
import { DbStory } from './model';

@Injectable()
export class StoryService {
  constructor(
    @Logger('story:service') private readonly logger: ILogger,
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly scriptureRefService: ScriptureReferenceService,
    private readonly authorizationService: AuthorizationService
  ) {}

  @OnIndex()
  async createIndexes() {
    return [
      'CREATE CONSTRAINT ON (n:Story) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:Story) ASSERT n.id IS UNIQUE',

      'CREATE CONSTRAINT ON (n:Story) ASSERT EXISTS(n.createdAt)',

      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',

      'CREATE CONSTRAINT ON (n:StoryName) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:StoryName) ASSERT n.value IS UNIQUE',
    ];
  }

  async create(input: CreateStory, session: Session): Promise<Story> {
    const checkStory = await this.db
      .query()
      .match([node('story', 'StoryName', { value: input.name })])
      .return('story')
      .first();

    if (checkStory) {
      throw new DuplicateException(
        'story.name',
        'Story with this name already exists.'
      );
    }

    const secureProps = [
      {
        key: 'name',
        value: input.name,
        isPublic: true,
        isOrgPublic: true,
        label: 'StoryName',
      },
      {
        key: 'canDelete',
        value: true,
        isPublic: false,
        isOrgPublic: false,
      },
    ];
    try {
      const result = await this.db
        .query()
        .apply(matchRequestingUser(session))
        .apply(
          createBaseNode(
            await generateId(),
            ['Story', 'Producible'],
            secureProps
          )
        )
        .return('node.id as id')
        .first();

      if (!result) {
        throw new ServerException('failed to create a story');
      }

      const dbStory = new DbStory();
      await this.authorizationService.processNewBaseNode(
        dbStory,
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

  async readOne(id: ID, session: Session): Promise<Story> {
    this.logger.debug(`Read Story`, {
      id,
      userId: session.userId,
    });

    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'Story', { id })])
      .apply(matchPropList)
      .return('node, propList')
      .asResult<StandardReadResult<DbPropsOfDto<Story>>>();

    const result = await query.first();

    if (!result) {
      throw new NotFoundException('Could not find story', 'story.id');
    }

    const scriptureReferences = await this.scriptureRefService.list(
      id,
      session
    );

    const securedProps = await this.authorizationService.secureProperties(
      Story,
      result.propList,
      session
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...securedProps,
      scriptureReferences: {
        ...securedProps.scriptureReferences,
        value: scriptureReferences,
      },
      canDelete: await this.db.checkDeletePermission(id, session),
    };
  }

  async update(input: UpdateStory, session: Session): Promise<Story> {
    const story = await this.readOne(input.id, session);
    const changes = this.db.getActualChanges(Story, story, input);
    await this.authorizationService.verifyCanEditChanges(Story, story, changes);
    const { scriptureReferences, ...simpleChanges } = changes;

    await this.scriptureRefService.update(input.id, scriptureReferences);
    await this.db.updateProperties({
      type: Story,
      object: story,
      changes: simpleChanges,
    });

    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const story = await this.readOne(id, session);
    if (!story) {
      throw new NotFoundException('Could not find Story');
    }
    const canDelete = await this.db.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Story'
      );

    try {
      await this.db.deleteNode(story);
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }

    this.logger.debug(`deleted story with id`, { id });
  }

  async list(
    { filter, ...input }: StoryListInput,
    session: Session
  ): Promise<StoryListOutput> {
    const query = this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode('Story')])
      .apply(calculateTotalAndPaginateList(Story, input));

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }
}
