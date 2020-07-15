import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ISession } from '../../common';
import {
  ConfigService,
  DatabaseService,
  ILogger,
  Logger,
  matchSession,
  OnIndex,
} from '../../core';
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
      .raw(
        `
        MATCH(story:StoryName {value: $name}) return story
        `,
        {
          name: input.name,
        }
      )
      .first();

    if (checkStory) {
      throw new BadRequestException(
        'Story with that name already exists.',
        'Duplicate'
      );
    }
    const id = generate();
    const createdAt = DateTime.local();
    try {
      const query = this.db
        .query()
        .match(matchSession(session, { withAclEdit: 'canCreateStory' }))
        .match([
          node('rootuser', 'User', {
            active: true,
            id: this.config.rootAdmin.id,
          }),
        ])
        .create([
          [
            node('newStory', ['Story', 'Producible', 'BaseNode'], {
              active: true,
              createdAt,
              id,
              owningOrgId: session.owningOrgId,
            }),
          ],
          ...this.property('name', input.name, 'newStory'),
          [
            node('adminSG', 'SecurityGroup', {
              id: generate(),
              active: true,
              createdAt,
              name: input.name + ' admin',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('readerSG', 'SecurityGroup', {
              id: generate(),
              active: true,
              createdAt,
              name: input.name + ' users',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('adminSG'),
            relation('out', '', 'member', { active: true, createdAt }),
            node('rootuser'),
          ],
          [
            node('readerSG'),
            relation('out', '', 'member', { active: true, createdAt }),
            node('rootuser'),
          ],
          ...this.permission('name', 'newStory'),
          ...this.permission('range', 'newStory'),
          // TODO scriptureReferences
        ])
        .return(
          'newStory.id as id, requestingUser.canCreateStory as canCreateStory'
        );
      await query.first();
    } catch (err) {
      this.logger.error(`Could not create story for user ${session.userId}`);
      throw new ServerException('Could not create story');
    }
    this.logger.info(`story created`, { id });
    return this.readOne(id, session);
  }

  async readOne(storyId: string, session: ISession): Promise<Story> {
    const readStory = this.db
      .query()
      .match(matchSession(session, { withAclEdit: 'canReadStorys' }))
      .match([node('story', 'Story', { active: true, id: storyId })])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadRange', 'Permission', {
          property: 'range',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('story'),
        relation('out', '', 'name', { active: true }),
        node('name', 'Property', { active: true }),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canEditRange', 'Permission', {
          property: 'range',
          active: true,
          edit: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('story'),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadName', 'Permission', {
          property: 'name',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('story'),
        relation('out', '', 'range', { active: true }),
        node('rangeNode', 'Property', { active: true }),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canEditName', 'Permission', {
          property: 'name',
          active: true,
          edit: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('story'),
      ])
      .return({
        story: [{ id: 'id', createdAt: 'createdAt' }],
        name: [{ value: 'name' }],
        requestingUser: [
          { canReadStorys: 'canReadStorys', canCreateStory: 'canCreateStory' },
        ],
        canReadName: [{ read: 'canReadName' }],
        canEditName: [{ edit: 'canEditName' }],
        rangeNode: [{ value: 'range' }],
        canReadRange: [{ read: 'canReadRange' }],
        canEditRange: [{ edit: 'canEditRange' }],
      });

    let result;
    try {
      result = await readStory.first();
    } catch {
      throw new ServerException('Read Story Error');
    }
    if (!result) {
      throw new NotFoundException('Could not find story');
    }
    if (!result.canReadStorys) {
      throw new ForbiddenException(
        'User does not have permission to read a story'
      );
    }
    return {
      id: result.id,
      name: {
        value: result.name,
        canRead: !!result.canReadName,
        canEdit: !!result.canEditName,
      },
      scriptureReferences: {
        // TODO
        canRead: true,
        canEdit: true,
        value: [],
      },
      createdAt: result.createdAt,
    };
  }

  async update(input: UpdateStory, session: ISession): Promise<Story> {
    const story = await this.readOne(input.id, session);
    return this.db.sgUpdateProperties({
      session,
      object: story,
      props: ['name'],
      changes: input, // TODO scriptureReferences
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
    } catch (e) {
      this.logger.error('Failed to delete', { id, exception: e });
      throw new ServerException('Failed to delete');
    }

    this.logger.info(`deleted story with id`, { id });
  }

  async list(
    { page, count, sort, order, filter }: StoryListInput,
    session: ISession
  ): Promise<StoryListOutput> {
    const result = await this.db.list<Story>({
      session,
      nodevar: 'story',
      aclReadProp: 'canReadStorys',
      aclEditProp: 'canCreateStory',
      props: ['name'],
      input: {
        page,
        count,
        sort,
        order,
        filter,
      },
    });
    const items = result.items.length
      ? await Promise.all(
          result.items.map(async (r) => {
            return this.readOne(r.id, session);
          })
        )
      : [];

    return {
      items: (items as unknown) as Story[],
      hasMore: result.hasMore,
      total: result.total,
    };
  }
}
