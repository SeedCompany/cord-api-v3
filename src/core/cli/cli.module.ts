import { Module } from '@nestjs/common';
import { CommandDiscovery } from './command.discovery';

@Module({
  providers: [CommandDiscovery],
})
export class CliModule {}
