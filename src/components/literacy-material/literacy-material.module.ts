import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ScriptureModule } from '../scripture/scripture.module';
import { LiteracyMaterialLoader } from './literacy-material.loader';
import { LiteracyMaterialRepository } from './literacy-material.repository';
import { LiteracyMaterialResolver } from './literacy-material.resolver';
import { LiteracyMaterialService } from './literacy-material.service';

@Module({
  imports: [forwardRef(() => AuthorizationModule), ScriptureModule],
  providers: [
    LiteracyMaterialResolver,
    LiteracyMaterialService,
    LiteracyMaterialRepository,
    LiteracyMaterialLoader,
  ],
  exports: [LiteracyMaterialService],
})
export class LiteracyMaterialModule {}
