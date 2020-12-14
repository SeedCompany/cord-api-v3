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
  matchPermList,
  matchPropList,
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
  CreateFilm,
  Film,
  FilmListInput,
  FilmListOutput,
  UpdateFilm,
} from './dto';
import { DbFilm } from './model';

@Injectable()
export class FilmService {
  private readonly securedProperties = {
    name: true,
    scriptureReferences: true,
  };

  constructor(
    @Logger('film:service') private readonly logger: ILogger,
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly scriptureRefService: ScriptureReferenceService,
    private readonly authorizationService: AuthorizationService
  ) {}

  @OnIndex()
  async createIndexes() {
    return [
      'CREATE CONSTRAINT ON (n:Film) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:Film) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:Film) ASSERT EXISTS(n.createdAt)',

      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',

      'CREATE CONSTRAINT ON (n:FilmName) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:FilmName) ASSERT n.value IS UNIQUE',
    ];
  }

  async create(input: CreateFilm, session: Session): Promise<Film> {
    const checkFm = await this.db
      .query()
      .match([node('film', 'FilmName', { value: input.name })])
      .return('film')
      .first();

    if (checkFm) {
      throw new DuplicateException(
        'film.name',
        'Film with this name already exists'
      );
    }

    const secureProps = [
      {
        key: 'name',
        value: input.name,
        isPublic: true,
        isOrgPublic: true,
        label: 'FilmName',
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
          ['Film', 'Producible'],
          secureProps
        )
        .return('node.id as id')
        .first();

      if (!result) {
        throw new ServerException('failed to create a film');
      }

      await this.scriptureRefService.create(
        result.id,
        input.scriptureReferences,
        session
      );

      this.logger.debug(`flim created`, { id: result.id });
      return await this.readOne(result.id, session);
    } catch (exception) {
      this.logger.error(`Could not create film`, {
        exception,
        userId: session.userId,
      });
      throw new ServerException('Could not create film', exception);
    }
  }

  async readOne(id: string, session: Session): Promise<Film> {
    this.logger.debug(`Read film`, {
      id,
      userId: session.userId,
    });

    const readFilm = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'Film', { id })])
      .call(matchPermList)
      .call(matchPropList, 'permList')
      .return('node, permList, propList')
      .asResult<StandardReadResult<DbPropsOfDto<Film>>>();

    const result = await readFilm.first();

    if (!result) {
      throw new NotFoundException('Could not find film', 'film.id');
    }

    const scriptureReferences = await this.scriptureRefService.list(
      id,
      session
    );

    const securedProps = parseSecuredProperties(
      result.propList,
      result.permList,
      this.securedProperties
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

  async update(input: UpdateFilm, session: Session): Promise<Film> {
    await this.scriptureRefService.update(input.id, input.scriptureReferences);

    const film = await this.readOne(input.id, session);
    return await this.db.sgUpdateProperties({
      session,
      object: film,
      props: ['name'],
      changes: input,
      nodevar: 'film',
    });
  }

  async delete(id: string, session: Session): Promise<void> {
    const film = await this.readOne(id, session);

    if (!film) {
      throw new NotFoundException('Could not find Film');
    }

    const canDelete = await this.db.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Film'
      );

    const baseNodeLabels = ['BaseNode', 'Producible', 'Film'];

    const uniqueProperties: UniqueProperties<Film> = {
      name: ['Property', 'FilmName'],
    };

    try {
      await this.db.deleteNodeNew({
        object: film,
        baseNodeLabels,
        uniqueProperties,
      });
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }

    this.logger.debug(`deleted film with id`, { id });
  }

  async list(
    { filter, ...input }: FilmListInput,
    session: Session
  ): Promise<FilmListOutput> {
    const query = this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode('Film')])
      .call(
        calculateTotalAndPaginateList,
        input,
        this.securedProperties,
        defaultSorter
      );

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }
}
