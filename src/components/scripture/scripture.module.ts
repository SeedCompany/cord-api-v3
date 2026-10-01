import { Module } from '@nestjs/common';
import { ScriptureCollectionResolver } from './scripture-collection.resolver';
import { ScriptureRangeResolver } from './scripture-range.resolver';
import { ScriptureReferenceResolver } from './scripture-reference.resolver';
import { ScriptureReferenceService } from './scripture-reference.service';

@Module({
  providers: [
    ScriptureCollectionResolver,
    ScriptureReferenceResolver,
    ScriptureRangeResolver,
    ScriptureReferenceService,
  ],
  exports: [ScriptureReferenceService],
})
export class ScriptureModule {}
