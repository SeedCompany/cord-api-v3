import { Module } from '@nestjs/common';
import { RangeModule } from '../range';
import { FilmResolver } from './film.resolver';
import { FilmService } from './film.service';

@Module({
  imports: [RangeModule],
  providers: [FilmResolver, FilmService],
  exports: [FilmService],
})
export class FilmModule {}
