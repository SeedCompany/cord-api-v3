import { Injectable } from '@nestjs/common';
import {
  AbstractGraphQLDriver as AbstractDriver,
  type GqlModuleOptions,
} from '@nestjs/graphql';
import { cmpBy, patchMethod } from '@seedcompany/common';
import { withAsyncContextIterator } from '@seedcompany/nest';
import type { RouteOptions as FastifyRoute } from 'fastify';
import type { ExecutionArgs } from 'graphql';
import { CloseCode, DEPRECATED_GRAPHQL_WS_PROTOCOL } from 'graphql-ws';
import { makeHandler as makeGqlWSHandler } from 'graphql-ws/use/@fastify/websocket';
import {
  createYoga,
  type envelop,
  type YogaServerInstance,
  type YogaServerOptions,
} from 'graphql-yoga';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { WebSocket } from 'ws';
import { type GqlContextType } from '~/common';
import { MetadataDiscovery } from '~/core/discovery';
import { HttpAdapter, type IRequest } from '../http';
import { type IResponse } from '../http/types';
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
  private yoga?: YogaServerInstance<ServerContext, {}>;

  constructor(
    private readonly discovery: MetadataDiscovery,
    private readonly http: HttpAdapter,
  ) {
    super();
  }

  async start(options: DriverConfig) {
    const fastify = this.http.getInstance();

    // Do our plugin discovery / registration
    const discoveredPlugins = this.discovery.discover(Plugin).classes<Plugin>();
    options.plugins = [
      MaintainAsyncContextInSubscriptionEvents,
      ...(options.plugins ?? []),
      ...discoveredPlugins
        .toSorted(cmpBy(({ meta }) => meta.priority))
        .map((cls) => cls.instance),
    ];

    this.yoga = createYoga({
      ...options,
      graphqlEndpoint: options.path,
      logging: false,
      batching: { limit: 25 },
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
    const res = await this.yoga!.handleNodeRequestAndResponse(req, reply, {
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
      { socket: WebSocket; request: IRequest }
    >({
      schema: options.schema!,
      // Custom execute/subscribe functions that really just defer to a
      // unique envelop (yoga) instance per request.
      execute: (wsArgs) => {
        const { envelop, socket, ...args } = wsArgs as WsExecutionArgs;
        return envelop.execute(args);
      },
      subscribe: (wsArgs) => {
        const { envelop, socket, ...args } = wsArgs as WsExecutionArgs;
        return envelop.subscribe(args);
      },
      // Create a unique envelop/yoga instance for each subscription.
      // This allows "yoga" plugins that are really just envelop hooks
      // to be executed.
      onSubscribe: async (ctx, id, payload) => {
        const {
          extra: { request, socket },
        } = ctx;
        const envelop = this.yoga!.getEnveloped({
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
      /**
       * Suppress warning for deprecated protocol.
       * Apollo Studio attempts this protocol in its WS negotiation,
       * and we can't explicitly state we use the new one.
       * In practice, only legacy systems use this protocol,
       * and this acts as a false positive in our setup.
       * I think it gets triggered a lot too as our API process restarts
       * as we make code changes.
       * @see https://github.com/enisdenjo/graphql-ws/blob/0c0eb499c3a0278c6d9cc799064f22c5d24d2f60/src/use/%40fastify/websocket.ts#L179-L187
       */
      if (process.env.NODE_ENV !== 'production') {
        socket.once('close', (code) => {
          if (
            code === CloseCode.SubprotocolNotAcceptable &&
            socket.protocol === DEPRECATED_GRAPHQL_WS_PROTOCOL
          ) {
            // At this point, it should be fine to mutate the protocol
            // to suppress the warning.
            Object.defineProperty(socket, 'protocol', {
              value: `${DEPRECATED_GRAPHQL_WS_PROTOCOL}--suppress-warning`,
            });
          }
        });
      }

      // Patch socket.on('message') to resume the current async context.
      // All the subscription logic happens under a "subscribe" message.
      // So this fully encapsulates the subscription logic within the async context.
      const scoped = AsyncLocalStorage.snapshot();
      patchMethod(socket, 'on', (base) => (eventName, listener) => {
        if (eventName !== 'message') {
          return base(eventName, listener);
        }
        return base(eventName, (...args) => {
          scoped(listener, ...args);
        });
      });

      return fastifyWsHandler.call(this, socket, req);
    };
    return wsHandler;
  }

  async stop() {
    await this.yoga?.dispose();
  }
}

const MaintainAsyncContextInSubscriptionEvents: Plugin = {
  onSubscribe: ({ subscribeFn, setSubscribeFn }) => {
    setSubscribeFn(async (...args) => {
      const iterator: AsyncIterator<unknown> = await subscribeFn(...args);
      return withAsyncContextIterator(iterator);
    });
  },
};
