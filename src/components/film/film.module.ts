import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ScriptureModule } from '../scripture/scripture.module';
import { FilmRepository } from './film.repository';
import { FilmResolver } from './film.resolver';
import { FilmService } from './film.service';

@Module({
  imports: [forwardRef(() => AuthorizationModule), ScriptureModule],
  providers: [FilmResolver, FilmService, FilmRepository],
  exports: [FilmService, FilmRepository],
})
export class FilmModule {}
