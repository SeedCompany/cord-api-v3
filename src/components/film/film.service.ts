import { Injectable } from '@nestjs/common';
import {
  type ID,
  type ObjectView,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { ifDiff } from '~/core/database/changes';
import { HandleIdLookup } from '~/core/resources';
import { Privileges } from '../authorization';
import { isScriptureEqual } from '../scripture';
import {
  type CreateFilm,
  Film,
  type FilmListInput,
  type FilmListOutput,
  type UpdateFilm,
} from './dto';
import { FilmRepository } from './film.repository';

@Injectable()
export class FilmService {
  constructor(
    private readonly privileges: Privileges,
    private readonly repo: FilmRepository,
  ) {}

  async create(input: CreateFilm): Promise<Film> {
    const dto = await this.repo.create(input);
    this.privileges.for(Film, dto).verifyCan('create');
    return this.secure(dto);
  }

  @HandleIdLookup(Film)
  async readOne(id: ID, _view?: ObjectView): Promise<Film> {
    const result = await this.repo.readOne(id);
    return this.secure(result);
  }

  async readMany(ids: readonly ID[]) {
    const films = await this.repo.readMany(ids);
    return films.map((dto) => this.secure(dto));
  }

  private secure(dto: UnsecuredDto<Film>): Film {
    return this.privileges.for(Film).secure(dto);
  }

  async update(input: UpdateFilm): Promise<Film> {
    const film = await this.repo.readOne(input.id);
    const changes = {
      ...this.repo.getActualChanges(film, input),
      scriptureReferences: ifDiff(isScriptureEqual)(
        input.scriptureReferences,
        film.scriptureReferences,
      ),
    };
    this.privileges.for(Film, film).verifyChanges(changes);

    const updated = await this.repo.update({ id: input.id, ...changes });
    return this.secure(updated);
  }

  async delete(id: ID): Promise<void> {
    const film = await this.repo.readOne(id);

    this.privileges.for(Film, film).verifyCan('delete');

    try {
      await this.repo.deleteNode(film);
    } catch (exception) {
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(input: FilmListInput): Promise<FilmListOutput> {
    const results = await this.repo.list(input);
    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto)),
    };
  }
}
