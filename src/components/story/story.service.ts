import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import {
  DuplicateException,
  ISession,
  NotFoundException,
  ServerException,
} from '../../common';
import {
  ConfigService,
  createBaseNode,
  DatabaseService,
  getPermList,
  getPropList,
  ILogger,
  Logger,
  matchRequestingUser,
  OnIndex,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  parseSecuredProperties,
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
    @Inject(forwardRef(() => AuthorizationService))
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

  async create(input: CreateStory, session: ISession): Promise<Story> {
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
        isPublic: false,
        isOrgPublic: false,
        label: 'StoryName',
      },
    ];
    try {
      const result = await this.db
        .query()
        .call(matchRequestingUser, session)
        .call(createBaseNode, ['Story', 'Producible'], secureProps)
        .return('node.id as id')
        .first();

      if (!result) {
        throw new ServerException('failed to create a story');
      }

      const dbStory = new DbStory();
      await this.authorizationService.processNewBaseNode(
        dbStory,
        result.id,
        session.userId as string
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

  async readOne(id: string, session: ISession): Promise<Story> {
    this.logger.debug(`Read Story`, {
      id,
      userId: session.userId,
    });

    if (!session.userId) {
      this.logger.debug('using anon user id');
      session.userId = this.config.anonUser.id;
    }

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'Story', { id })])
      .call(getPermList, 'requestingUser')
      .call(getPropList, 'permList')
      .return('node, permList, propList')
      .asResult<StandardReadResult<DbPropsOfDto<Story>>>();

    const result = await query.first();

    if (!result) {
      throw new NotFoundException('Could not find story', 'story.id');
    }

    const scriptureReferences = await this.scriptureRefService.list(
      id,
      session
    );

    const securedProps = parseSecuredProperties(
      result.propList,
      result.permList,
      {
        name: true,
        scriptureReferences: true,
      }
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...securedProps,
      scriptureReferences: {
        ...securedProps.scriptureReferences,
        value: scriptureReferences,
      },
    };
  }

  async update(input: UpdateStory, session: ISession): Promise<Story> {
    await this.scriptureRefService.update(input.id, input.scriptureReferences);

    const story = await this.readOne(input.id, session);
    return await this.db.sgUpdateProperties({
      session,
      object: story,
      props: ['name'],
      changes: input,
      nodevar: 'story',
    });
  }

  async delete(id: string, session: ISession): Promise<void> {
    const story = await this.readOne(id, session);
    try {
      await this.db.deleteNode({
        session,
        object: story,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }

    this.logger.debug(`deleted story with id`, { id });
  }

  async list(
    { filter, ...input }: StoryListInput,
    session: ISession
  ): Promise<StoryListOutput> {
    const query = this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode('Story')])
      .call(calculateTotalAndPaginateList, input, (q, sort, order) =>
        q
          .match([
            node('node'),
            relation('out', '', sort),
            node('prop', 'Property'),
          ])
          .with('*')
          .orderBy('prop.value', order)
      );

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }
}
