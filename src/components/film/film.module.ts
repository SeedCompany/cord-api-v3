import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ScriptureModule } from '../scripture/scripture.module';
import { FilmResolver } from './film.resolver';
import { FilmService } from './film.service';

@Module({
  imports: [AuthorizationModule, ScriptureModule],
  providers: [FilmResolver, FilmService],
  exports: [FilmService],
})
export class FilmModule {}
