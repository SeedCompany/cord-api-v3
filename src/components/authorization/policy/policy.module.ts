import { Module } from '@nestjs/common';
import { PolicyFactory } from './policy.factory';
import { ResourcesHost } from './resources.host';

@Module({
  providers: [ResourcesHost, PolicyFactory],
  exports: [],
})
export class PolicyModule {}
