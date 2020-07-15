import { Module } from '@nestjs/common';
import { LiteracyMaterialResolver } from './literacy-material.resolver';
import { LiteracyMaterialService } from './literacy-material.service';

@Module({
  providers: [LiteracyMaterialResolver, LiteracyMaterialService],
  exports: [LiteracyMaterialService],
})
export class LiteracyMaterialModule {}
