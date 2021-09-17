import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ScriptureModule } from '../scripture/scripture.module';
import { FilmLoader } from './film.loader';
import { FilmRepository } from './film.repository';
import { FilmResolver } from './film.resolver';
import { FilmService } from './film.service';

@Module({
  imports: [forwardRef(() => AuthorizationModule), ScriptureModule],
  providers: [FilmResolver, FilmService, FilmRepository, FilmLoader],
  exports: [FilmService],
})
export class FilmModule {}
