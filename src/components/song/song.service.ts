import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import {
  DuplicateException,
  generateId,
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
  UniqueProperties,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  defaultSorter,
  matchPropListNew,
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
  CreateSong,
  Song,
  SongListInput,
  SongListOutput,
  UpdateSong,
} from './dto';
import { DbSong } from './model';

@Injectable()
export class SongService {
  private readonly securedProperties = {
    name: true,
    scriptureReferences: true,
  };

  constructor(
    @Logger('song:service') private readonly logger: ILogger,
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly scriptureRefService: ScriptureReferenceService,
    private readonly authorizationService: AuthorizationService
  ) {}

  @OnIndex()
  async createIndexes() {
    return [
      'CREATE CONSTRAINT ON (n:Song) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:Song) ASSERT n.id IS UNIQUE',

      'CREATE CONSTRAINT ON (n:Song) ASSERT EXISTS(n.createdAt)',

      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',

      'CREATE CONSTRAINT ON (n:SongName) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:SongName) ASSERT n.value IS UNIQUE',
    ];
  }

  async create(input: CreateSong, session: Session): Promise<Song> {
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
        isPublic: true,
        isOrgPublic: true,
        label: 'SongName',
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
        .call(matchRequestingUser, session)
        .call(
          createBaseNode,
          await generateId(),
          ['Song', 'Producible'],
          secureProps
        )
        .return('node.id as id')
        .first();

      if (!result) {
        throw new ServerException('failed to create a song');
      }

      const dbSong = new DbSong();
      await this.authorizationService.processNewBaseNode(
        dbSong,
        result.id,
        session.userId
      );

      await this.scriptureRefService.create(
        result.id,
        input.scriptureReferences,
        session
      );

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

  async readOne(id: string, session: Session): Promise<Song> {
    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'Song', { id })])
      .call(matchPropListNew)
      .return('propList, node')
      .asResult<StandardReadResult<DbPropsOfDto<Song>>>();

    const result = await query.first();

    if (!result) {
      throw new NotFoundException('Could not find song', 'song.id');
    }

    const scriptureReferences = await this.scriptureRefService.list(
      id,
      session
    );

    const securedProps = await this.authorizationService.getPermissionsOfBaseNode(
      {
        baseNode: new DbSong(),
        sessionOrUserId: session,
        propList: result.propList,
        propKeys: this.securedProperties,
      }
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

  async update(input: UpdateSong, session: Session): Promise<Song> {
    await this.scriptureRefService.update(input.id, input.scriptureReferences);

    const song = await this.readOne(input.id, session);

    return await this.db.sgUpdateProperties({
      session,
      object: song,
      props: ['name'],
      changes: input,
      nodevar: 'song',
    });
  }

  async delete(id: string, session: Session): Promise<void> {
    const song = await this.readOne(id, session);
    if (!song) {
      throw new NotFoundException('Could not find Song');
    }
    const canDelete = await this.db.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Song'
      );

    const baseNodeLabels = ['BaseNode', 'Song', 'Producible'];

    const uniqueProperties: UniqueProperties<Song> = {
      name: ['Property', 'SongName'],
    };

    try {
      await this.db.deleteNodeNew<Song>({
        object: song,
        baseNodeLabels,
        uniqueProperties,
      });
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }

    this.logger.debug(`deleted song with id`, { id });
  }

  async list(
    { filter, ...input }: SongListInput,
    session: Session
  ): Promise<SongListOutput> {
    const query = this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode('Song')])
      .call(
        calculateTotalAndPaginateList,
        input,
        this.securedProperties,
        defaultSorter
      );

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }
}
