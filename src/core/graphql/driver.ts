import { DiscoveryService } from '@golevelup/nestjs-discovery';
import { Injectable } from '@nestjs/common';
import {
  AbstractGraphQLDriver as AbstractDriver,
  GqlModuleOptions,
} from '@nestjs/graphql';
import type { RouteOptions as FastifyRoute } from 'fastify';
import {
  createYoga,
  YogaServerInstance,
  YogaServerOptions,
} from 'graphql-yoga';
import { GqlContextType } from '~/common';
import { HttpAdapter, IRequest } from '../http';
import { IResponse } from '../http/types';
import { Plugin } from './plugin.decorator';

export interface ServerContext {
  /** Cannot be `request` as {@link import('graphql-yoga').YogaInitialContext.request} overrides it */
  req: IRequest;
  response: IResponse;
}

export type DriverConfig = GqlModuleOptions &
  Omit<YogaServerOptions<ServerContext, GqlContextType>, 'context' | 'schema'>;

@Injectable()
export class Driver extends AbstractDriver<DriverConfig> {
  private yoga: YogaServerInstance<ServerContext, {}>;

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly http: HttpAdapter,
  ) {
    super();
  }

  async start(options: DriverConfig) {
    const fastify = this.http.getInstance();

    // Do our plugin discovery / registration
    const discoveredPlugins = await this.discovery.providersWithMetaAtKey(
      Plugin.KEY,
    );
    options.plugins = [
      ...(options.plugins ?? []),
      ...new Set(discoveredPlugins.map((cls) => cls.discoveredClass.instance)),
    ];

    this.yoga = createYoga({
      ...options,
      graphqlEndpoint: options.path,
      logging: false,
    });

    fastify.route({
      method: ['GET', 'POST', 'OPTIONS'],
      url: this.yoga.graphqlEndpoint,
      handler: this.httpHandler,
    });

    // Setup file upload handling
    fastify.addContentTypeParser('multipart/form-data', (req, payload, done) =>
      done(null),
    );
  }

  httpHandler: FastifyRoute['handler'] = async (req, reply) => {
    const res = await this.yoga.handleNodeRequestAndResponse(req, reply, {
      req,
      response: reply,
    });
    return await reply
      .headers(Object.fromEntries(res.headers))
      .status(res.status)
      .send(res.body);
  };

  async stop() {
    // noop
  }
}
