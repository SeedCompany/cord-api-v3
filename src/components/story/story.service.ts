import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  ISession,
  NotFoundException,
  ServerException,
} from '../../common';
import {
  addAllSecureProperties,
  addBaseNodeMetaPropsWithClauseAsObject,
  ConfigService,
  createBaseNode,
  DatabaseService,
  filterByString,
  getPermList,
  getPropList,
  ILogger,
  listWithSecureObjectAsObject,
  Logger,
  mapping,
  matchRequestingUser,
  matchUserPermissions,
  OnIndex,
  runListQuery,
} from '../../core';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  parsePropList,
  parseSecuredProperties,
  StandardReadResult,
} from '../../core/database/results';
import { ScriptureRange } from '../scripture';
import {
  scriptureToVerseRange,
  verseToScriptureRange,
} from '../scripture/reference';
import {
  CreateStory,
  Story,
  StoryListInput,
  StoryListOutput,
  UpdateStory,
} from './dto';
@Injectable()
export class StoryService {
  constructor(
    @Logger('story:service') private readonly logger: ILogger,
    private readonly db: DatabaseService,
    private readonly config: ConfigService
  ) {}

  @OnIndex()
  async createIndexes() {
    const constraints = [
      'CREATE CONSTRAINT ON (n:Story) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:Story) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:Story) ASSERT EXISTS(n.active)',
      'CREATE CONSTRAINT ON (n:Story) ASSERT EXISTS(n.createdAt)',
      'CREATE CONSTRAINT ON (n:Story) ASSERT EXISTS(n.owningOrgId)',

      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',

      'CREATE CONSTRAINT ON (n:StoryName) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:StoryName) ASSERT n.value IS UNIQUE',
    ];
    for (const query of constraints) {
      await this.db.query().raw(query).run();
    }
  }

  // helper method for defining properties
  property = (prop: string, value: any, baseNode: string) => {
    if (!value) {
      return [];
    }
    const createdAt = DateTime.local();
    const propLabel = prop === 'name' ? 'Property:StoryName' : 'Property:Range';
    return [
      [
        node(baseNode),
        relation('out', '', prop, {
          active: true,
          createdAt,
        }),
        node(prop, propLabel, {
          active: true,
          value,
        }),
      ],
    ];
  };

  // helper method for defining permissions
  permission = (property: string, baseNode: string) => {
    const createdAt = DateTime.local();
    return [
      [
        node('adminSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: true,
          admin: true,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node(baseNode),
      ],
      [
        node('readerSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: false,
          admin: false,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node(baseNode),
      ],
    ];
  };

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
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
        label: 'StoryName',
      },
    ];
    try {
      const query = this.db
        .query()
        .call(matchRequestingUser, session)
        .match([
          node('root', 'User', {
            active: true,
            id: this.config.rootAdmin.id,
          }),
        ])
        .call(createBaseNode, ['Story', 'Producible'], secureProps, {
          owningOrgId: session.owningOrgId,
        })
        .create([...this.permission('scriptureReferences', 'node')]);

      if (input.scriptureReferences) {
        for (const sr of input.scriptureReferences) {
          const verseRange = scriptureToVerseRange(sr);
          query.create([
            node('node'),
            relation('out', '', 'scriptureReferences', { active: true }),
            node('sr', 'ScriptureRange', {
              start: verseRange.start,
              end: verseRange.end,
              active: true,
              createdAt: DateTime.local(),
            }),
          ]);
        }
      }
      query.return('node.id as id');

      const result = await query.first();
      if (!result) {
        throw new ServerException('failed to create a story');
      }

      this.logger.info(`story created`, { id: result.id });
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
    this.logger.info(`Read Story`, {
      id,
      userId: session.userId,
    });

    if (!session.userId) {
      this.logger.info('using anon user id');
      session.userId = this.config.anonUser.id;
    }

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'Story', { active: true, id })])
      .call(getPermList, 'requestingUser')
      .call(getPropList, 'permList')
      .return('node, permList, propList')
      .asResult<StandardReadResult<DbPropsOfDto<Story>>>();

    const result = await query.first();

    if (!result) {
      throw new NotFoundException('Could not find story', 'story.id');
    }

    const scriptureReferences = await this.listScriptureReferences(
      result.node.properties.id,
      session
    );

    const props = parsePropList(result.propList);
    const securedProps = parseSecuredProperties(props, result.permList, {
      name: true,
      scriptureReferences: true,
    });

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
    const { scriptureReferences } = input;

    if (scriptureReferences) {
      const rel = 'scriptureReferences';
      await this.db
        .query()
        .match([
          node('story', 'Story', { id: input.id, active: true }),
          relation('out', 'rel', rel, { active: true }),
          node('sr', 'ScriptureRange', { active: true }),
        ])
        .setValues({
          'rel.active': false,
          'sr.active': false,
        })
        .return('sr')
        .first();

      for (const sr of scriptureReferences) {
        const verseRange = scriptureToVerseRange(sr);
        await this.db
          .query()
          .match([node('story', 'Story', { id: input.id, active: true })])
          .create([
            node('story'),
            relation('out', '', rel, { active: true }),
            node('', ['ScriptureRange', 'BaseNode'], {
              start: verseRange.start,
              end: verseRange.end,
              active: true,
              createdAt: DateTime.local(),
            }),
          ])
          .return('story')
          .first();
      }
    }
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

    this.logger.info(`deleted story with id`, { id });
  }

  async list(
    { filter, ...input }: StoryListInput,
    session: ISession
  ): Promise<StoryListOutput> {
    const baseNodeMetaProps = ['id', 'createdAt'];
    const secureProps = ['name'];
    const label = 'Story';

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, label);
    if (filter.name) {
      query.call(filterByString, label, 'name', filter.name);
    }
    query.call(addAllSecureProperties, ...secureProps).with(
      mapping('node', {
        ...addBaseNodeMetaPropsWithClauseAsObject(baseNodeMetaProps),
        ...listWithSecureObjectAsObject(secureProps),
      })
    );

    const listResult: StoryListOutput = await runListQuery(
      query,
      input,
      secureProps.includes(input.sort)
    );

    const items = await Promise.all(
      listResult.items.map((item) => {
        return this.readOne(item.id, session);
      })
    );

    return {
      items,
      hasMore: listResult.hasMore,
      total: listResult.total,
    };
  }

  async listScriptureReferences(
    storyId: string,
    session: ISession
  ): Promise<ScriptureRange[]> {
    const query = this.db
      .query()
      .match([
        node('story', 'Story', {
          id: storyId,
          active: true,
          owningOrgId: session.owningOrgId,
        }),
        relation('out', '', 'scriptureReferences'),
        node('scriptureRanges', 'ScriptureRange', { active: true }),
      ])
      .with('collect(scriptureRanges) as items')
      .return('items');
    const result = await query.first();

    if (!result) {
      return [];
    }

    const items: ScriptureRange[] = await Promise.all(
      result.items.map(
        (item: {
          identity: string;
          labels: string;
          properties: {
            start: number;
            end: number;
            createdAt: string;
            active: boolean;
          };
        }) => {
          return verseToScriptureRange({
            start: item.properties.start,
            end: item.properties.end,
          });
        }
      )
    );

    return items;
  }
}
