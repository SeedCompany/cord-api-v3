import { Injectable } from '@nestjs/common';
import {
  ID,
  ObjectView,
  ServerException,
  Session,
  UnsecuredDto,
} from '~/common';
import { HandleIdLookup } from '~/core';
import { ifDiff } from '~/core/database/changes';
import { Privileges } from '../authorization';
import { isScriptureEqual } from '../scripture';
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
    private readonly privileges: Privileges,
    private readonly repo: FilmRepository,
  ) {}

  async create(input: CreateFilm, session: Session): Promise<Film> {
    const dto = await this.repo.create(input, session);
    this.privileges.for(session, Film, dto).verifyCan('create');
    return this.secure(dto, session);
  }

  @HandleIdLookup(Film)
  async readOne(id: ID, session: Session, _view?: ObjectView): Promise<Film> {
    const result = await this.repo.readOne(id);
    return this.secure(result, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const films = await this.repo.readMany(ids);
    return films.map((dto) => this.secure(dto, session));
  }

  private secure(dto: UnsecuredDto<Film>, session: Session): Film {
    return this.privileges.for(session, Film).secure(dto);
  }

  async update(input: UpdateFilm, session: Session): Promise<Film> {
    const film = await this.repo.readOne(input.id);
    const changes = {
      ...this.repo.getActualChanges(film, input),
      scriptureReferences: ifDiff(isScriptureEqual)(
        input.scriptureReferences,
        film.scriptureReferences,
      ),
    };
    this.privileges.for(session, Film, film).verifyChanges(changes);

    const updated = await this.repo.update({ id: input.id, ...changes });
    return this.secure(updated, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const film = await this.repo.readOne(id);

    this.privileges.for(session, Film, film).verifyCan('delete');

    try {
      await this.repo.deleteNode(film);
    } catch (exception) {
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(input: FilmListInput, session: Session): Promise<FilmListOutput> {
    const results = await this.repo.list(input);
    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto, session)),
    };
  }
}
