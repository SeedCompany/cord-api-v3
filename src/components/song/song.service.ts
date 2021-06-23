import { Injectable } from '@nestjs/common';
import {
  DuplicateException,
  ID,
  NotFoundException,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../common';
import { HandleIdLookup, ILogger, Logger, OnIndex } from '../../core';
import {
  parseBaseNodeProperties,
  runListQuery,
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
import { SongRepository } from './song.repository';

@Injectable()
export class SongService {
  constructor(
    @Logger('song:service') private readonly logger: ILogger,
    private readonly scriptureRefService: ScriptureReferenceService,
    private readonly authorizationService: AuthorizationService,
    private readonly repo: SongRepository
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
    const checkSong = await this.repo.checkSong(input);

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
      const result = await this.repo.create(session, secureProps);

      if (!result) {
        throw new ServerException('failed to create a song');
      }

      await this.authorizationService.processNewBaseNode(
        Song,
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

  @HandleIdLookup(Song)
  async readOne(id: ID, session: Session): Promise<Song> {
    const result = await this.repo.readOne(id, session);
    if (!result) {
      throw new NotFoundException('Could not find song', 'song.id');
    }

    const scriptureReferences = await this.scriptureRefService.list(
      id,
      session
    );

    const securedProps = await this.authorizationService.secureProperties(
      Song,
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
      canDelete: await this.repo.checkDeletePermission(id, session),
    };
  }

  async update(input: UpdateSong, session: Session): Promise<Song> {
    const song = await this.readOne(input.id, session);
    const changes = this.repo.getActualChanges(song, input);
    await this.authorizationService.verifyCanEditChanges(Song, song, changes);
    const { scriptureReferences, ...simpleChanges } = changes;

    await this.scriptureRefService.update(input.id, scriptureReferences);
    await this.repo.updateProperties(song, simpleChanges);

    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const song = await this.readOne(id, session);
    if (!song) {
      throw new NotFoundException('Could not find Song');
    }
    const canDelete = await this.repo.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Song'
      );

    try {
      await this.repo.deleteNode(song);
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
    const query = this.repo.list({ filter, ...input }, session);
    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }
}
