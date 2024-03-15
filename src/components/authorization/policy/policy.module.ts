import { Module } from '@nestjs/common';
import { EdgeDBAccessPolicyGenerator } from './edgedb-access-policy.generator';
import { PolicyDumpCommand, PolicyDumper } from './executor/policy-dumper';
import { PolicyExecutor } from './executor/policy-executor';
import { Privileges } from './executor/privileges';
import { GrantersFactory } from './granters.factory';
import { PolicyFactory } from './policy.factory';

@Module({
  providers: [
    GrantersFactory,
    PolicyFactory,
    PolicyExecutor,
    Privileges,
    PolicyDumper,
    PolicyDumpCommand,
    EdgeDBAccessPolicyGenerator,
  ],
  exports: [Privileges, EdgeDBAccessPolicyGenerator],
})
export class PolicyModule {}
