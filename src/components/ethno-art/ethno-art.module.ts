import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ScriptureModule } from '../scripture/scripture.module';
import { EthnoArtEdgeDBRepository } from './ethno-art.edgedb.repository';
import { EthnoArtLoader } from './ethno-art.loader';
import { EthnoArtRepository } from './ethno-art.repository';
import { EthnoArtResolver } from './ethno-art.resolver';
import { EthnoArtService } from './ethno-art.service';

@Module({
  imports: [forwardRef(() => AuthorizationModule), ScriptureModule],
  providers: [
    EthnoArtLoader,
    EthnoArtResolver,
    splitDb(EthnoArtRepository, EthnoArtEdgeDBRepository),
    EthnoArtService,
  ],
  exports: [EthnoArtService],
})
export class EthnoArtModule {}
