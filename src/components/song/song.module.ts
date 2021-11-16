import { Module } from '@nestjs/common';
import { EthnoArtModule } from '../ethno-art/ethno-art.module';
import { SongResolver } from './song.resolver';

@Module({
  imports: [EthnoArtModule],
  providers: [SongResolver],
})
export class SongModule {}
