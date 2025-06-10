import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { Film } from './dto';
import { FilmService } from './film.service';

@LoaderFactory(() => Film)
export class FilmLoader implements DataLoaderStrategy<Film, ID<Film>> {
  constructor(private readonly films: FilmService) {}

  async loadMany(ids: ReadonlyArray<ID<Film>>) {
    return await this.films.readMany(ids);
  }
}
