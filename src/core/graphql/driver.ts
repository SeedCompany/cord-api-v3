import { DiscoveryService } from '@golevelup/nestjs-discovery';
import { Injectable } from '@nestjs/common';
import {
  AbstractGraphQLDriver as AbstractDriver,
  GqlModuleOptions,
} from '@nestjs/graphql';
import type { RouteOptions as FastifyRoute } from 'fastify';
import type { ExecutionArgs } from 'graphql';
import { makeHandler as makeGqlWSHandler } from 'graphql-ws/lib/use/@fastify/websocket';
import {
  createYoga,
  type envelop,
  YogaServerInstance,
  YogaServerOptions,
} from 'graphql-yoga';
import { noop } from 'lodash';
import { AsyncResource } from 'node:async_hooks';
import type { WebSocket } from 'ws';
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
      method: 'GET',
      url: this.yoga.graphqlEndpoint,
      handler: this.httpHandler,
      // Allow this same path to handle websocket upgrade requests.
      wsHandler: this.makeWsHandler(options),
    });
    fastify.route({
      method: ['POST', 'OPTIONS'],
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

  /**
   * This code ties fastify, yoga, and graphql-ws together.
   * Execution layers in order:
   * 1. fastify route (http path matching)
   * 2. fastify's websocket plugin (http upgrade request & websocket open/close)
   *    This allows our fastify hooks to be executed.
   *    And provides a consistent Fastify `Request` type,
   *    instead of a raw `IncomingMessage`.
   * 3. `graphql-ws`'s fastify handler (adapts #2 to graphql-ws)
   * 4. `graphql-ws` (handles specific gql protocol over websockets)
   * 5. `graphql-yoga` is unwrapped to `envelop`.
   *    Yoga just wraps `envelop` and handles more of the http layer.
   *    We really just reference `envelop` hooks with our "Yoga Plugins".
   *    So this allows our "yoga" plugins to be executed.
   */
  private makeWsHandler(options: DriverConfig) {
    const asyncContextBySocket = new WeakMap<WebSocket, AsyncResource>();
    interface WsExecutionArgs extends ExecutionArgs {
      socket: WebSocket;
      envelop: ReturnType<ReturnType<typeof envelop>>;
    }

    // The graphql-ws handler which accepts the fastify websocket/request and
    // orchestrates the subscription setup & execution.
    // This forwards to yoga/envelop.
    // This was adapted from yoga's graphql-ws example.
    // https://github.com/dotansimha/graphql-yoga/tree/main/examples/graphql-ws
    const fastifyWsHandler = makeGqlWSHandler<
      Record<string, unknown>,
      { connection: { socket: WebSocket }; request: IRequest }
    >({
      schema: options.schema!,
      // Custom execute/subscribe functions that really just defer to a
      // unique envelop (yoga) instance per request.
      execute: (wsArgs) => {
        const { envelop, socket, ...args } = wsArgs as WsExecutionArgs;
        return asyncContextBySocket.get(socket)!.runInAsyncScope(() => {
          return envelop.execute(args);
        });
      },
      subscribe: (wsArgs) => {
        const { envelop, socket, ...args } = wsArgs as WsExecutionArgs;
        // Because this is called via socket.onmessage, we don't have
        // the same async context we started with.
        // Grab and resume it.
        return asyncContextBySocket.get(socket)!.runInAsyncScope(() => {
          return envelop.subscribe(args);
        });
      },
      // Create a unique envelop/yoga instance for each subscription.
      // This allows "yoga" plugins that are really just envelop hooks
      // to be executed.
      onSubscribe: async (ctx, { payload }) => {
        const {
          extra: {
            request,
            connection: { socket },
          },
        } = ctx;
        const envelop = this.yoga.getEnveloped({
          req: request,
          socket,
          params: payload, // Same(ish?) shape as YogaInitialContext.params
        });

        const args: WsExecutionArgs = {
          schema: envelop.schema,
          operationName: payload.operationName,
          document: envelop.parse(payload.query),
          variableValues: payload.variables,
          contextValue: await envelop.contextFactory(),
          // These are needed in our execute()/subscribe() declared above.
          // Public examples put these functions in the context, but I don't
          // like exposing that implementation detail to the rest of the app.
          envelop,
          socket,
        };

        const errors = envelop.validate(args.schema, args.document);
        if (errors.length) {
          return errors;
        }
        return args;
      },
    });

    const wsHandler: FastifyRoute['wsHandler'] = function (socket, req) {
      // graphql-ws' fastify adapter still uses v9 of @fastify/websocket
      // which has the socket wrapped in a SocketStream.
      // v10+ removed this default wrapping.
      // This adapts the socket for the usage of the adapter.
      // The adapter's types are incorrect; they're using our v11 types,
      // but their source is developed with v9.
      // They just unwrap the socket out, and add a once('error')
      // which we can ignore since they add the same handler to socket as well.
      const connection = { socket, once: noop } as any;
      // Save a reference to the current async context, so we can resume it.
      asyncContextBySocket.set(socket, new AsyncResource('graphql-ws'));
      return fastifyWsHandler.call(this, connection, req);
    };
    return wsHandler;
  }

  async stop() {
    // noop
  }
}
