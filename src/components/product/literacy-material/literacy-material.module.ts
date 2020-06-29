import { Module } from '@nestjs/common';
import { RangeModule } from '../range/range.module';
import { LiteracyMaterialResolver } from './literacy-material.resolver';
import { LiteracyMaterialService } from './literacy-material.service';

@Module({
  imports: [RangeModule],
  providers: [LiteracyMaterialResolver, LiteracyMaterialService],
  exports: [LiteracyMaterialService],
})
export class LiteracyMaterialModule {}
