import { Module } from '@nestjs/common';
import { PolicyExecutor } from './executor/policy-executor';
import { Privileges } from './executor/privileges';
import { GrantersFactory } from './granters.factory';
import { PolicyFactory } from './policy.factory';

@Module({
  providers: [GrantersFactory, PolicyFactory, PolicyExecutor, Privileges],
  exports: [Privileges],
})
export class PolicyModule {}
