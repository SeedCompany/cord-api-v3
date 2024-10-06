import { DiscoveryService } from '@golevelup/nestjs-discovery';
import { YogaDriver, YogaDriverConfig } from '@graphql-yoga/nestjs';
import { Injectable } from '@nestjs/common';
import { HttpAdapter } from '../http';
import { Plugin } from './plugin.decorator';

@Injectable()
export class Driver extends YogaDriver<'fastify'> {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly http: HttpAdapter,
  ) {
    super();
  }

  async start(options: YogaDriverConfig<'fastify'>) {
    // Do our plugin discovery / registration
    const discoveredPlugins = await this.discovery.providersWithMetaAtKey(
      Plugin.KEY,
    );
    options.plugins = [
      ...(options.plugins ?? []),
      ...discoveredPlugins.map((cls) => cls.discoveredClass.instance),
    ];

    await super.start(options);

    // Setup file upload handling
    const fastify = this.http.getInstance();
    fastify.addContentTypeParser('multipart/form-data', (req, payload, done) =>
      done(null),
    );
  }
}
