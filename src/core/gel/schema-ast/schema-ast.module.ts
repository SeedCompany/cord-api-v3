import { Module } from '@nestjs/common';
import {
  GelAccessPolicyEjectCommand,
  GelAccessPolicyInjectCommand,
  GelAccessPolicyWrapCommand,
} from './access-policy.commands';
import { GelAccessPolicyInjector } from './access-policy.injector';
import { CrudeAstParser } from './crude-ast-parser';

@Module({
  providers: [
    CrudeAstParser,
    GelAccessPolicyInjector,
    GelAccessPolicyWrapCommand,
    GelAccessPolicyInjectCommand,
    GelAccessPolicyEjectCommand,
  ],
})
export class GelSchemaAstModule {}
