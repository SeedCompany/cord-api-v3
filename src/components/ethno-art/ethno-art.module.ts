import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ScriptureModule } from '../scripture/scripture.module';
import { EthnoArtLoader } from './ethno-art.loader';
import { EthnoArtRepository } from './ethno-art.repository';
import { EthnoArtResolver } from './ethno-art.resolver';
import { EthnoArtService } from './ethno-art.service';
import * as migrations from './migrations';

@Module({
  imports: [forwardRef(() => AuthorizationModule), ScriptureModule],
  providers: [
    EthnoArtLoader,
    EthnoArtResolver,
    EthnoArtRepository,
    EthnoArtService,
    ...Object.values(migrations),
  ],
  exports: [EthnoArtService],
})
export class EthnoArtModule {}
