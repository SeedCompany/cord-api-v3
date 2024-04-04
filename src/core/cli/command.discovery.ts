import {
  DiscoveredModule,
  DiscoveryService,
} from '@golevelup/nestjs-discovery';
import { Injectable } from '@nestjs/common';
import { Command } from 'clipanion';

@Injectable()
export class CommandDiscovery {
  constructor(private readonly discovery: DiscoveryService) {}

  async discover() {
    const discovered = await this.discovery.providersWithMetaAtKey(
      Command as any,
    );
    return discovered.map((d) => {
      const command = d.discoveredClass as DiscoveredModule<Command>;
      return new Proxy(command.dependencyType, {
        construct() {
          return command.instance;
        },
      });
    });
  }
}
