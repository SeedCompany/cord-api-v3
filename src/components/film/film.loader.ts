import { Injectable, Scope } from '@nestjs/common';
import { ID } from '../../common';
import { OrderedNestDataLoader } from '../../core';
import { Film } from './dto';
import { FilmService } from './film.service';

@Injectable({ scope: Scope.REQUEST })
export class FilmLoader extends OrderedNestDataLoader<Film> {
  constructor(private readonly films: FilmService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.films.readMany(ids, this.session);
  }
}
