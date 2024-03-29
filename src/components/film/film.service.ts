import { Injectable } from '@nestjs/common';
import {
  DuplicateException,
  ID,
  ObjectView,
  SecuredList,
  ServerException,
  Session,
} from '../../common';
import { DbTypeOf, HandleIdLookup, ILogger, Logger } from '../../core';
import { ifDiff } from '../../core/database/changes';
import { mapListResults } from '../../core/database/results';
import { Privileges } from '../authorization';
import { isScriptureEqual } from '../scripture';
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
    private readonly scriptureRefs: ScriptureReferenceService,
    private readonly privileges: Privileges,
    private readonly repo: FilmRepository,
  ) {}

  async create(input: CreateFilm, session: Session): Promise<Film> {
    this.privileges.for(session, Film).verifyCan('create');

    if (!(await this.repo.isUnique(input.name))) {
      throw new DuplicateException(
        'film.name',
        'Film with this name already exists',
      );
    }

    try {
      const result = await this.repo.create(input, session);

      if (!result) {
        throw new ServerException('failed to create a film');
      }

      await this.scriptureRefs.create(
        result.id,
        input.scriptureReferences,
        session,
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

  private async secure(dto: DbTypeOf<Film>, session: Session): Promise<Film> {
    return this.privileges.for(session, Film).secure({
      ...dto,
      scriptureReferences: this.scriptureRefs.parseList(
        dto.scriptureReferences,
      ),
    });
  }

  async update(input: UpdateFilm, session: Session): Promise<Film> {
    const film = await this.readOne(input.id, session);
    const changes = {
      ...this.repo.getActualChanges(film, input),
      scriptureReferences: ifDiff(isScriptureEqual)(
        input.scriptureReferences,
        film.scriptureReferences.value,
      ),
    };
    this.privileges.for(session, Film, film).verifyChanges(changes);
    const { scriptureReferences, ...simpleChanges } = changes;

    await this.scriptureRefs.update(input.id, scriptureReferences);

    await this.repo.update(film, simpleChanges);

    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const film = await this.readOne(id, session);

    this.privileges.for(session, Film, film).verifyCan('delete');

    try {
      await this.repo.deleteNode(film);
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }

    this.logger.debug(`deleted film with id`, { id });
  }

  async list(input: FilmListInput, session: Session): Promise<FilmListOutput> {
    if (this.privileges.for(session, Film).can('read')) {
      const results = await this.repo.list(input, session);
      return await mapListResults(results, (dto) => this.secure(dto, session));
    } else {
      return SecuredList.Redacted;
    }
  }
}
