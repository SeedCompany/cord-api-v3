import { Module } from '@nestjs/common';
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
  ],
  exports: [Privileges],
})
export class PolicyModule {}
