import { Module } from '@nestjs/common';
import { PolicyExecutor } from './executor/policy-executor';
import { Privileges } from './executor/privileges';
import { PolicyFactory } from './policy.factory';

@Module({
  providers: [PolicyFactory, PolicyExecutor, Privileges],
  exports: [Privileges],
})
export class PolicyModule {}
