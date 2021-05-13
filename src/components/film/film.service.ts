import { Injectable } from '@nestjs/common';
import {
  DuplicateException,
  ID,
  NotFoundException,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../common';
import { ConfigService, ILogger, Logger, OnIndex } from '../../core';
import {
  parseBaseNodeProperties,
  runListQuery,
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
import { FilmRepository } from './film.repository';
import { DbFilm } from './model';

@Injectable()
export class FilmService {
  constructor(
    @Logger('film:service') private readonly logger: ILogger,
    // private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly scriptureRefService: ScriptureReferenceService,
    private readonly authorizationService: AuthorizationService,
    private readonly repo: FilmRepository
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
    // const checkFm = await this.db
    //   .query()
    //   .match([node('film', 'FilmName', { value: input.name })])
    //   .return('film')
    //   .first();

    const checkFm = await this.repo.checkFilm(input.name);

    if (checkFm) {
      throw new DuplicateException(
        'film.name',
        'Film with this name already exists'
      );
    }

    // const secureProps = [
    //   {
    //     key: 'name',
    //     value: input.name,
    //     isPublic: true,
    //     isOrgPublic: true,
    //     label: 'FilmName',
    //   },
    //   {
    //     key: 'canDelete',
    //     value: true,
    //     isPublic: false,
    //     isOrgPublic: false,
    //   },
    // ];
    try {
      const result = await this.repo.createFilm(input.name, session);
      // const result = await this.db
      //   .query()
      //   .apply(matchRequestingUser(session))
      //   .apply(
      //     createBaseNode(
      //       await generateId(),
      //       ['Film', 'Producible'],
      //       secureProps
      //     )
      //   )
      //   .return('node.id as id')
      //   .first();

      if (!result) {
        throw new ServerException('failed to create a film');
      }

      const dbFilm = new DbFilm();
      await this.authorizationService.processNewBaseNode(
        dbFilm,
        result.id,
        session.userId
      );

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

  async readOne(id: ID, session: Session): Promise<Film> {
    this.logger.debug(`Read film`, {
      id,
      userId: session.userId,
    });

    // const readFilm = this.db
    //   .query()
    //   .apply(matchRequestingUser(session))
    //   .match([node('node', 'Film', { id })])
    //   .apply(matchPropList)
    //   .return('node, propList')
    //   .asResult<StandardReadResult<DbPropsOfDto<Film>>>();

    // const result = await readFilm.first();

    const result = await this.repo.readOne(id, session);

    if (!result) {
      throw new NotFoundException('Could not find film', 'film.id');
    }

    const scriptureReferences = await this.scriptureRefService.list(
      id,
      session
    );
    const securedProps = await this.authorizationService.secureProperties(
      Film,
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
      // canDelete: await this.db.checkDeletePermission(id, session),
    };
  }

  async update(input: UpdateFilm, session: Session): Promise<Film> {
    const film = await this.readOne(input.id, session);
    const changes = this.repo.getActualChanges(film, input);
    await this.authorizationService.verifyCanEditChanges(Film, film, changes);
    const { scriptureReferences, ...simpleChanges } = changes;

    await this.scriptureRefService.update(input.id, scriptureReferences);

    await this.repo.updateProperties(film, simpleChanges);
    // await this.db.updateProperties({
    //   type: Film,
    //   object: film,
    //   changes: simpleChanges,
    // });

    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const film = await this.readOne(id, session);

    if (!film) {
      throw new NotFoundException('Could not find Film');
    }

    const canDelete = await this.repo.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Film'
      );

    try {
      await this.repo.deleteNode(film);
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
    const query = this.repo.list({ filter, ...input }, session);
    // const query = this.db
    //   .query()
    //   .match([requestingUser(session), ...permissionsOfNode('Film')])
    //   .apply(calculateTotalAndPaginateList(Film, input));

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }
}
