import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ScriptureModule } from '../scripture/scripture.module';
import { EthnoArtDrizzleRepository } from './ethno-art.drizzle.repository';
import { EthnoArtGelRepository } from './ethno-art.gel.repository';
import { EthnoArtLoader } from './ethno-art.loader';
import { EthnoArtRepository } from './ethno-art.repository';
import { EthnoArtResolver } from './ethno-art.resolver';
import { EthnoArtService } from './ethno-art.service';

@Module({
  imports: [forwardRef(() => AuthorizationModule), ScriptureModule],
  providers: [
    EthnoArtLoader,
    EthnoArtResolver,
    splitDb(EthnoArtRepository, {
      gel: EthnoArtGelRepository,
      // migration-todo: `as any` removed at Phase 7 cutover when splitDb
      // disappears with the Neo4j path.
      postgres: EthnoArtDrizzleRepository as any,
    }),
    EthnoArtService,
  ],
  exports: [EthnoArtService],
})
export class EthnoArtModule {}
