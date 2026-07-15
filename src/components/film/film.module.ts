import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ScriptureModule } from '../scripture';
import { FilmDrizzleRepository } from './film.drizzle.repository';
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
    splitDb(FilmRepository, {
      gel: FilmGelRepository,
      // migration-todo: `as any` removed at Phase 7 cutover when splitDb
      // disappears with the Neo4j path.
      postgres: FilmDrizzleRepository as any,
    }),
    FilmLoader,
  ],
  exports: [FilmService],
})
export class FilmModule {}
