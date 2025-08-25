import { Injectable } from '@nestjs/common';
import { type Command } from 'clipanion';
import { MetadataDiscovery } from '~/core/discovery';
import { CommandWatermark } from './decorator';

@Injectable()
export class CommandDiscovery {
  constructor(private readonly discovery: MetadataDiscovery) {}

  async discover() {
    return this.discovery
      .discover(CommandWatermark)
      .classes<Command>()
      .map(
        ({ instance: command }) =>
          new Proxy(command.constructor, {
            construct() {
              return command;
            },
          }),
      );
  }
}
