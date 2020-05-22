import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IdArg, ISession, Session } from '../../../common';
import { RangeService } from '../range';
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

@Resolver(Film.classType)
export class FilmResolver {
  constructor(
    private readonly filmService: FilmService,
    private readonly rangeService: RangeService
  ) {}

  @Mutation(() => CreateFilmOutput, {
    description: 'Create an film',
  })
  async createFilm(
    @Session() session: ISession,
    @Args('input') { film: input }: CreateFilmInput
  ): Promise<CreateFilmOutput> {
    const film = await this.filmService.create(input, session);
    return { film };
  }

  @Query(() => Film, {
    description: 'Look up an film by its ID',
  })
  async film(@Session() session: ISession, @IdArg() id: string): Promise<Film> {
    return this.filmService.readOne(id, session);
  }

  @Query(() => FilmListOutput, {
    description: 'Look up films',
  })
  async films(
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => FilmListInput,
      defaultValue: FilmListInput.defaultVal,
    })
    input: FilmListInput
  ): Promise<FilmListOutput> {
    return this.filmService.list(input, session);
  }

  @Mutation(() => UpdateFilmOutput, {
    description: 'Update an film',
  })
  async updateFilm(
    @Session() session: ISession,
    @Args('input') { film: input }: UpdateFilmInput
  ): Promise<UpdateFilmOutput> {
    const film = await this.filmService.update(input, session);
    if (input.range) {
      await this.rangeService.update(input.range, session, input.id);
    }
    return { film };
  }

  @Mutation(() => Boolean, {
    description: 'Delete an film',
  })
  async deleteFilm(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<boolean> {
    await this.filmService.delete(id, session);
    return true;
  }
}
