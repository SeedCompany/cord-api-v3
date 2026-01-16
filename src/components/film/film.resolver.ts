import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { type ID, IdArg, ListArg } from '~/common';
import { Loader, type LoaderOf } from '~/core';
import {
  CreateFilm,
  CreateFilmOutput,
  DeleteFilmOutput,
  Film,
  FilmListInput,
  FilmListOutput,
  UpdateFilm,
  UpdateFilmOutput,
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

  @Mutation(() => CreateFilmOutput, {
    description: 'Create a film',
  })
  async createFilm(
    @Args('input') input: CreateFilm,
  ): Promise<CreateFilmOutput> {
    const film = await this.filmService.create(input);
    return { film };
  }

  @Mutation(() => UpdateFilmOutput, {
    description: 'Update a film',
  })
  async updateFilm(
    @Args('input') input: UpdateFilm,
  ): Promise<UpdateFilmOutput> {
    const film = await this.filmService.update(input);
    return { film };
  }

  @Mutation(() => DeleteFilmOutput, {
    description: 'Delete a film',
  })
  async deleteFilm(@IdArg() id: ID): Promise<DeleteFilmOutput> {
    await this.filmService.delete(id);
    return { success: true };
  }
}
