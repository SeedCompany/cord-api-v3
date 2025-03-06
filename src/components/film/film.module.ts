import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ScriptureModule } from '../scripture';
import { FilmGelRepository } from './film.gel.repository';
import { FilmLoader } from './film.loader';
import { FilmRepository } from './film.repository';
import { FilmResolver } from './film.resolver';
import { FilmService } from './film.service';

@Module({
  imports: [forwardRef(() => AuthorizationModule), ScriptureModule],
  providers: [
    FilmResolver,
    FilmService,
    splitDb(FilmRepository, FilmGelRepository),
    FilmLoader,
  ],
  exports: [FilmService],
})
export class FilmModule {}
