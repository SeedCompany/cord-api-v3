import { Module } from '@nestjs/common';
import { ScriptureRangeResolver } from './scripture-range.resolver';
import { ScriptureReferenceResolver } from './scripture-reference.resolver';

@Module({
  providers: [ScriptureReferenceResolver, ScriptureRangeResolver],
})
export class ScriptureModule {}
