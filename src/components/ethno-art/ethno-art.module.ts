import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ScriptureModule } from '../scripture/scripture.module';
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
    splitDb(EthnoArtRepository, EthnoArtGelRepository),
    EthnoArtService,
  ],
  exports: [EthnoArtService],
})
export class EthnoArtModule {}
