import { Injectable, NotFoundException } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { DuplicateException, ISession, ServerException } from '../../common';
import {
  addAllSecureProperties,
  addBaseNodeMetaPropsWithClause,
  addPropertyCoalesceWithClause,
  addUserToSG,
  ConfigService,
  createBaseNode,
  DatabaseService,
  filterByString,
  ILogger,
  listWithSecureObject,
  Logger,
  matchRequestingUser,
  matchUserPermissions,
  OnIndex,
  runListQuery,
} from '../../core';
import {
  CreateSong,
  Song,
  SongListInput,
  SongListOutput,
  UpdateSong,
} from './dto';

@Injectable()
export class SongService {
  constructor(
    @Logger('song:service') private readonly logger: ILogger,
    private readonly db: DatabaseService,
    private readonly config: ConfigService
  ) {}

  @OnIndex()
  async createIndexes() {
    const constraints = [
      'CREATE CONSTRAINT ON (n:Song) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:Song) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:Song) ASSERT EXISTS(n.active)',
      'CREATE CONSTRAINT ON (n:Song) ASSERT EXISTS(n.createdAt)',
      'CREATE CONSTRAINT ON (n:Song) ASSERT EXISTS(n.owningOrgId)',

      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',

      'CREATE CONSTRAINT ON (n:SongName) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:SongName) ASSERT n.value IS UNIQUE',
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
    const propLabel = prop === 'name' ? 'Property:SongName' : 'Property:Range';
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

  async create(input: CreateSong, session: ISession): Promise<Song> {
    const checkSong = await this.db
      .query()
      .match([node('song', 'SongName', { value: input.name })])
      .return('song')
      .first();

    if (checkSong) {
      throw new DuplicateException(
        'song.name',
        'Song with this name already exists.'
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
        label: 'SongName',
      },
    ];

    try {
      const query = this.db
        .query()
        .call(matchRequestingUser, session)
        .match([
          node('rootUser', 'User', {
            active: true,
            id: this.config.rootAdmin.id,
          }),
        ])
        .call(createBaseNode, ['Song', 'Producible'], secureProps, {
          owningOrgId: session.owningOrgId,
        })
        .create([...this.permission('range', 'node')])
        .call(addUserToSG, 'rootUser', 'adminSG')
        .call(addUserToSG, 'rootUser', 'readerSG')
        .return('node.id as id');

      const result = await query.first();
      if (!result) {
        throw new ServerException('failed to create a song');
      }

      const id = result.id;

      // add root admin to new song as an admin
      await this.db.addRootAdminToBaseNodeAsAdmin(id, 'Song');

      this.logger.info(`song created`, { id: result.id });

      return await this.readOne(result.id, session);
    } catch (err) {
      this.logger.error(`Could not create song for user ${session.userId}`);
      throw new ServerException('Could not create song');
    }
  }

  async readOne(id: string, session: ISession): Promise<Song> {
    if (!session.userId) {
      session.userId = this.config.anonUser.id;
    }

    const secureProps = ['name', 'range'];

    const readSong = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, 'Song', id)
      .call(addAllSecureProperties, ...secureProps)
      .with([
        ...secureProps.map(addPropertyCoalesceWithClause),
        'coalesce(node.id) as id',
        'coalesce(node.createdAt) as createdAt',
      ])
      .returnDistinct([...secureProps, 'id', 'createdAt']);

    const result = (await readSong.first()) as Song | undefined;
    if (!result) {
      throw new NotFoundException('Could not find song');
    }

    return {
      ...result,
      scriptureReferences: {
        canEdit: true,
        canRead: true,
        value: [],
      },
    };
  }

  async update(input: UpdateSong, session: ISession): Promise<Song> {
    const song = await this.readOne(input.id, session);

    return this.db.sgUpdateProperties({
      session,
      object: song,
      props: ['name'], // TODO scriptureReferences
      changes: input,
      nodevar: 'song',
    });
  }

  async delete(id: string, session: ISession): Promise<void> {
    const song = await this.readOne(id, session);
    try {
      await this.db.deleteNode({
        session,
        object: song,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      this.logger.error('Failed to delete', { id, exception: e });
      throw new ServerException('Failed to delete');
    }

    this.logger.info(`deleted song with id`, { id });
  }

  async list(
    { filter, ...input }: SongListInput,
    session: ISession
  ): Promise<SongListOutput> {
    const label = 'Song';
    const baseNodeMetaProps = ['id', 'createdAt'];
    const secureProps = ['name'];

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, label);

    if (filter.name) {
      query.call(filterByString, label, 'name', filter.name);
    }

    // match on the rest of the properties of the object requested
    query.call(addAllSecureProperties, ...secureProps).with(
      `
          {
            ${addBaseNodeMetaPropsWithClause(baseNodeMetaProps)},
            ${listWithSecureObject(secureProps)}
          } as node
        `
    );

    const result: SongListOutput = await runListQuery(
      query,
      input,
      secureProps.includes(input.sort)
    );
    const items = result.items.map((row: any) => {
      return {
        ...row,
        scriptureReferences: {
          // TODO
          canRead: true,
          canEdit: true,
          value: [],
        },
      };
    });

    return {
      items,
      hasMore: result.hasMore,
      total: result.total,
    };
  }
}
