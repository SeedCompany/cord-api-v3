import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ScriptureModule } from '../scripture/scripture.module';
import { LiteracyMaterialRepository } from './literacy-material.repository';
import { LiteracyMaterialResolver } from './literacy-material.resolver';
import { LiteracyMaterialService } from './literacy-material.service';

@Module({
  imports: [forwardRef(() => AuthorizationModule), ScriptureModule],
  providers: [
    LiteracyMaterialResolver,
    LiteracyMaterialService,
    LiteracyMaterialRepository,
  ],
  exports: [LiteracyMaterialService, LiteracyMaterialRepository],
})
export class LiteracyMaterialModule {}
