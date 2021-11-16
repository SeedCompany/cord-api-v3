import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AnonSession, ID, IdArg, LoggedInSession, Session } from '../../common';
import { Loader, LoaderOf } from '../../core';
import {
  CreateFilmInput,
  CreateFilmOutput,
  DeleteFilmOutput,
  Film,
  FilmListInput,
  FilmListOutput,
  UpdateFilmInput,
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
    @IdArg() id: ID
  ): Promise<Film> {
    return await films.load(id);
  }

  @Query(() => FilmListOutput, {
    description: 'Look up films',
  })
  async films(
    @Args({
      name: 'input',
      type: () => FilmListInput,
      defaultValue: FilmListInput.defaultVal,
    })
    input: FilmListInput,
    @Loader(FilmLoader) films: LoaderOf<FilmLoader>,
    @AnonSession() session: Session
  ): Promise<FilmListOutput> {
    const list = await this.filmService.list(input, session);
    films.primeAll(list.items);
    return list;
  }

  @Mutation(() => CreateFilmOutput, {
    description: 'Create a film',
  })
  async createFilm(
    @LoggedInSession() session: Session,
    @Args('input') { film: input }: CreateFilmInput
  ): Promise<CreateFilmOutput> {
    const film = await this.filmService.create(input, session);
    return { film };
  }

  @Mutation(() => UpdateFilmOutput, {
    description: 'Update a film',
  })
  async updateFilm(
    @LoggedInSession() session: Session,
    @Args('input') { film: input }: UpdateFilmInput
  ): Promise<UpdateFilmOutput> {
    const film = await this.filmService.update(input, session);
    return { film };
  }

  @Mutation(() => DeleteFilmOutput, {
    description: 'Delete a film',
  })
  async deleteFilm(
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<DeleteFilmOutput> {
    await this.filmService.delete(id, session);
    return { success: true };
  }
}
