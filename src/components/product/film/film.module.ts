import { Module } from '@nestjs/common';
import { RangeModule } from '../range/range.module';
import { FilmResolver } from './film.resolver';
import { FilmService } from './film.service';

@Module({
  imports: [RangeModule],
  providers: [FilmResolver, FilmService],
  exports: [FilmService],
})
export class FilmModule {}
