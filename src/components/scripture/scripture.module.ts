import { Module } from '@nestjs/common';
import { ScriptureReferenceResolver } from './scripture-reference.resolver';

@Module({
  providers: [ScriptureReferenceResolver],
})
export class ScriptureModule {}
