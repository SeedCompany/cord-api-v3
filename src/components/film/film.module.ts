import { Module } from '@nestjs/common';
import { ScriptureModule } from '../scripture/scripture.module';
import { FilmResolver } from './film.resolver';
import { FilmService } from './film.service';

@Module({
  imports: [ScriptureModule],
  providers: [FilmResolver, FilmService],
  exports: [FilmService],
})
export class FilmModule {}
