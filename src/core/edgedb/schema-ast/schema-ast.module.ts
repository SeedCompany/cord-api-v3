import { Module } from '@nestjs/common';
import {
  EdgeDBAccessPolicyEjectCommand,
  EdgeDBAccessPolicyInjectCommand,
  EdgeDBAccessPolicyWrapMigrateCommand,
} from './access-policy.commands';
import { EdgeDBAccessPolicyInjector } from './access-policy.injector';
import { CrudeAstParser } from './crude-ast-parser';

@Module({
  providers: [
    CrudeAstParser,
    EdgeDBAccessPolicyInjector,
    EdgeDBAccessPolicyWrapMigrateCommand,
    EdgeDBAccessPolicyInjectCommand,
    EdgeDBAccessPolicyEjectCommand,
  ],
})
export class EdgeDBSchemaAstModule {}
