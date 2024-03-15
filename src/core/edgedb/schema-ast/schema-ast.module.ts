import { Module } from '@nestjs/common';
import { EdgeDBAccessPolicyInjector } from './access-policy.injector';
import { CrudeAstParser } from './crude-ast-parser';

@Module({
  providers: [CrudeAstParser, EdgeDBAccessPolicyInjector],
})
export class EdgeDBSchemaAstModule {}
