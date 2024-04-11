import { Module } from '@nestjs/common';
import {
  EdgeDBAccessPolicyEjectCommand,
  EdgeDBAccessPolicyInjectCommand,
  EdgeDBAccessPolicyWrapCommand,
} from './access-policy.commands';
import { EdgeDBAccessPolicyInjector } from './access-policy.injector';
import { CrudeAstParser } from './crude-ast-parser';

@Module({
  providers: [
    CrudeAstParser,
    EdgeDBAccessPolicyInjector,
    EdgeDBAccessPolicyWrapCommand,
    EdgeDBAccessPolicyInjectCommand,
    EdgeDBAccessPolicyEjectCommand,
  ],
})
export class EdgeDBSchemaAstModule {}
