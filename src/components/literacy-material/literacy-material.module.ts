import { Module } from '@nestjs/common';
import { EthnoArtModule } from '../ethno-art/ethno-art.module';
import { LiteracyMaterialResolver } from './literacy-material.resolver';

@Module({
  imports: [EthnoArtModule],
  providers: [LiteracyMaterialResolver],
})
export class LiteracyMaterialModule {}
