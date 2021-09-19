import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AnonSession, ID, IdArg, LoggedInSession, Session } from '../../common';
import {
  CreateFilmInput,
  CreateFilmOutput,
  Film,
  FilmListInput,
  FilmListOutput,
  UpdateFilmInput,
  UpdateFilmOutput,
} from './dto';
import { FilmService } from './film.service';

@Resolver(Film)
export class FilmResolver {
  constructor(private readonly filmService: FilmService) {}

  @Query(() => Film, {
    description: 'Look up a film by its ID',
  })
  async film(@AnonSession() session: Session, @IdArg() id: ID): Promise<Film> {
    return await this.filmService.readOne(id, session);
  }

  @Query(() => FilmListOutput, {
    description: 'Look up films',
  })
  async films(
    @AnonSession() session: Session,
    @Args({
      name: 'input',
      type: () => FilmListInput,
      defaultValue: FilmListInput.defaultVal,
    })
    input: FilmListInput
  ): Promise<FilmListOutput> {
    return await this.filmService.list(input, session);
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

  @Mutation(() => Boolean, {
    description: 'Delete a film',
  })
  async deleteFilm(
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<boolean> {
    await this.filmService.delete(id, session);
    return true;
  }
}
