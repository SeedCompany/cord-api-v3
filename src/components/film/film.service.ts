import { Injectable } from '@nestjs/common';
import {
  DuplicateException,
  ID,
  NotFoundException,
  ObjectView,
  SecuredList,
  ServerException,
  Session,
  UnauthorizedException,
  UnsecuredDto,
} from '../../common';
import { HandleIdLookup, ILogger, Logger } from '../../core';
import { ifDiff } from '../../core/database/changes';
import { mapListResults } from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { isScriptureEqual } from '../scripture/books';
import { ScriptureReferenceService } from '../scripture/scripture-reference.service';
import {
  CreateFilm,
  Film,
  FilmListInput,
  FilmListOutput,
  UpdateFilm,
} from './dto';
import { FilmRepository } from './film.repository';

@Injectable()
export class FilmService {
  constructor(
    @Logger('film:service') private readonly logger: ILogger,
    private readonly scriptureRefService: ScriptureReferenceService,
    private readonly authorizationService: AuthorizationService,
    private readonly repo: FilmRepository
  ) {}

  async create(input: CreateFilm, session: Session): Promise<Film> {
    if (!(await this.repo.isUnique(input.name))) {
      throw new DuplicateException(
        'film.name',
        'Film with this name already exists'
      );
    }

    try {
      const result = await this.repo.createFilm(input, session);

      if (!result) {
        throw new ServerException('failed to create a film');
      }

      await this.authorizationService.processNewBaseNode(
        Film,
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

  @HandleIdLookup(Film)
  async readOne(id: ID, session: Session, _view?: ObjectView): Promise<Film> {
    this.logger.debug(`Read film`, {
      id,
      userId: session.userId,
    });

    const result = await this.repo.readOne(id);
    return await this.secure(result, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const films = await this.repo.readMany(ids);
    return await Promise.all(films.map((dto) => this.secure(dto, session)));
  }

  private async secure(
    dto: UnsecuredDto<Film>,
    session: Session
  ): Promise<Film> {
    const securedProps = await this.authorizationService.secureProperties(
      Film,
      dto,
      session
    );

    const scriptureReferences = await this.scriptureRefService.list(
      dto.id,
      session
    );

    return {
      ...dto,
      ...securedProps,
      scriptureReferences: {
        ...securedProps.scriptureReferences,
        value: scriptureReferences,
      },
      canDelete: await this.repo.checkDeletePermission(dto.id, session),
    };
  }

  async update(input: UpdateFilm, session: Session): Promise<Film> {
    const film = await this.readOne(input.id, session);
    const changes = {
      ...this.repo.getActualChanges(film, input),
      scriptureReferences: ifDiff(isScriptureEqual)(
        input.scriptureReferences,
        film.scriptureReferences.value
      ),
    };
    await this.authorizationService.verifyCanEditChanges(Film, film, changes);
    const { scriptureReferences, ...simpleChanges } = changes;

    await this.scriptureRefService.update(input.id, scriptureReferences);

    await this.repo.updateProperties(film, simpleChanges);

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

  async list(input: FilmListInput, session: Session): Promise<FilmListOutput> {
    if (await this.authorizationService.canList(Film, session)) {
      const results = await this.repo.list(input, session);
      return await mapListResults(results, (dto) => this.secure(dto, session));
    } else {
      return SecuredList.Redacted;
    }
  }
}
