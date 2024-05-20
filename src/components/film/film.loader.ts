import { ID } from '~/common';
import { LoaderFactory, OrderedNestDataLoader } from '~/core';
import { Film } from './dto';
import { FilmService } from './film.service';

@LoaderFactory(() => Film)
export class FilmLoader extends OrderedNestDataLoader<Film> {
  constructor(private readonly films: FilmService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.films.readMany(ids, this.session);
  }
}
