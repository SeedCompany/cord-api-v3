import { Module } from '@nestjs/common';
import { PolicyExecutor } from './executor/policy-executor';
import { Privileges } from './executor/privileges';
import { PolicyFactory } from './policy.factory';
import { ResourcesHost } from './resources.host';

@Module({
  providers: [ResourcesHost, PolicyFactory, PolicyExecutor, Privileges],
  exports: [Privileges],
})
export class PolicyModule {}
