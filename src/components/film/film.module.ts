import { Module } from '@nestjs/common';
import { FilmResolver } from './film.resolver';
import { FilmService } from './film.service';

@Module({
  providers: [FilmResolver, FilmService],
  exports: [FilmService],
})
export class FilmModule {}
