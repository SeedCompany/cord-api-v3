import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ScriptureModule } from '../scripture/scripture.module';
import { LiteracyMaterialResolver } from './literacy-material.resolver';
import { LiteracyMaterialService } from './literacy-material.service';

@Module({
  imports: [AuthorizationModule, ScriptureModule],
  providers: [LiteracyMaterialResolver, LiteracyMaterialService],
  exports: [LiteracyMaterialService],
})
export class LiteracyMaterialModule {}
