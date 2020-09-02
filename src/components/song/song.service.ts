import { Injectable } from '@nestjs/common';
import { contains, node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  ISession,
  NotFoundException,
  ServerException,
} from '../../common';
import {
  addUserToSG,
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
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  parsePropList,
  parseSecuredProperties,
  runListQuery,
  StandardReadResult,
} from '../../core/database/results';
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

      this.logger.debug(`song created`, { id: result.id });

      return await this.readOne(result.id, session);
    } catch (exception) {
      this.logger.error(`Could not create song`, {
        exception,
        userId: session.userId,
      });
      throw new ServerException('Could not create song', exception);
    }
  }

  async readOne(id: string, session: ISession): Promise<Song> {
    if (!session.userId) {
      session.userId = this.config.anonUser.id;
    }

    if (!session.userId) {
      this.logger.debug('using anon user id');
      session.userId = this.config.anonUser.id;
    }

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'Song', { active: true, id })])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member*1..'),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission'),
        node('perms', 'Permission', { active: true }),
        relation('out', '', 'baseNode'),
        node('node'),
      ])
      .with('collect(distinct perms) as permList, node')
      .match([
        node('node'),
        relation('out', 'r', { active: true }),
        node('props', 'Property', { active: true }),
      ])
      .with('{value: props.value, property: type(r)} as prop, permList, node')
      .with('collect(prop) as propList, permList, node')
      .return('propList, permList, node')
      .asResult<StandardReadResult<DbPropsOfDto<Song>>>();

    const result = await query.first();

    if (!result) {
      throw new NotFoundException('Could not find song', 'song.id');
    }

    const props = parsePropList(result.propList);
    const securedProps = parseSecuredProperties(props, result.permList, {
      name: true,
    });

    return {
      ...parseBaseNodeProperties(result.node),
      ...securedProps,
      id: result?.node?.properties?.id,
      createdAt: result?.node?.properties?.createdAt,
      scriptureReferences: {
        canEdit: true,
        canRead: true,
        value: [],
      },
    };
  }

  async update(input: UpdateSong, session: ISession): Promise<Song> {
    const song = await this.readOne(input.id, session);

    return await this.db.sgUpdateProperties({
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
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }

    this.logger.debug(`deleted song with id`, { id });
  }

  async list(
    { filter, ...input }: SongListInput,
    session: ISession
  ): Promise<SongListOutput> {
    const label = 'Song';
    const query = this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode(label),
        ...(filter.name
          ? [
              relation('out', '', 'name', { active: true }),
              node('name', 'Property', { active: true }),
            ]
          : []),
      ])
      .call((q) =>
        filter.name ? q.where({ name: { value: contains(filter.name) } }) : q
      )
      .call(calculateTotalAndPaginateList, input, (q, sort, order) =>
        q
          .match([
            node('node'),
            relation('out', '', sort),
            node('prop', 'Property', { active: true }),
          ])
          .with('*')
          .orderBy('prop.value', order)
      );

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }
}
