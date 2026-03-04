import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { type ID, IdArg, ListArg } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import {
  CreateFilm,
  Film,
  FilmCreated,
  FilmDeleted,
  FilmListInput,
  FilmListOutput,
  FilmUpdated,
  UpdateFilm,
} from './dto';
import { FilmLoader } from './film.loader';
import { FilmService } from './film.service';

@Resolver(Film)
export class FilmResolver {
  constructor(private readonly filmService: FilmService) {}

  @Query(() => Film, {
    description: 'Look up a film by its ID',
  })
  async film(
    @Loader(FilmLoader) films: LoaderOf<FilmLoader>,
    @IdArg() id: ID,
  ): Promise<Film> {
    return await films.load(id);
  }

  @Query(() => FilmListOutput, {
    description: 'Look up films',
  })
  async films(
    @ListArg(FilmListInput) input: FilmListInput,
    @Loader(FilmLoader) films: LoaderOf<FilmLoader>,
  ): Promise<FilmListOutput> {
    const list = await this.filmService.list(input);
    films.primeAll(list.items);
    return list;
  }

  @Mutation(() => FilmCreated, {
    description: 'Create a film',
  })
  async createFilm(@Args('input') input: CreateFilm): Promise<FilmCreated> {
    const film = await this.filmService.create(input);
    return { film };
  }

  @Mutation(() => FilmUpdated, {
    description: 'Update a film',
  })
  async updateFilm(@Args('input') input: UpdateFilm): Promise<FilmUpdated> {
    const film = await this.filmService.update(input);
    return { film };
  }

  @Mutation(() => FilmDeleted, {
    description: 'Delete a film',
  })
  async deleteFilm(@IdArg() id: ID): Promise<FilmDeleted> {
    await this.filmService.delete(id);
    return {};
  }
}
