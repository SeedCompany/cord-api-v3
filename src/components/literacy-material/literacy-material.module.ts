import { Module } from '@nestjs/common';
import { ScriptureModule } from '../scripture/scripture.module';
import { LiteracyMaterialResolver } from './literacy-material.resolver';
import { LiteracyMaterialService } from './literacy-material.service';

@Module({
  imports: [ScriptureModule],
  providers: [LiteracyMaterialResolver, LiteracyMaterialService],
  exports: [LiteracyMaterialService],
})
export class LiteracyMaterialModule {}
