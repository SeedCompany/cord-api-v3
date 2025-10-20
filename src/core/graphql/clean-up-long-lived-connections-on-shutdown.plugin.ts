import { type TypedSubscriptionArgs } from '@envelop/types/hooks';
import { Optional } from '@nestjs/common';
import { Subject } from 'rxjs';
import { Disabled, type GqlContextType } from '~/common';
import { type ILogger, Logger } from '~/core/logger';
import { Plugin } from './plugin.decorator';

/**
 * This plugin closes long-lived connections, such as subscriptions, during shutdown.
 *
 * This is a "graceful" action that:
 * - Allows the server to close (without forcing a `process.exit()`, I believe).
 *   In dev, this means the server process can restart as expected with code changes.
 * - Communicates the disconnect to the client, allowing them to attempt
 *   reconnection on a new server instance.
 *
 * Tracking responses and calling `stream.destroy()` is how this happens.
 * This is the best way I could come up with, as it signals to the client
 * an unexpected disconnect so that they should attempt a reconnection.
 * What I didn't want to do is "complete" the observable/async-iteration,
 * that would communicate to the client that the stream is done,
 * and no further connection is required.
 *
 * Why isn't this built into the HTTP/GraphQL server layer?
 * Well, I'm unconventionally discriminating which requests are "long-lived".
 * Subscriptions and live queries are long-lived and can have their stream
 * interrupted without much consequence.
 * GQL queries delivered incrementally via (@defer/@stream) are treated as
 * "medium-lived" (I just made that up), where they deliver data in parts,
 * but we assume that they will close on their own after a short period
 * (Say less than a minute).
 * Normal queries & mutations are also short-lived, producing a single response.
 * The strategy implemented here is too intent to let the server finish processing
 * those requests before closing.
 * So mutations can be completed gracefully, and short queries don't have to start over.
 *
 * If we didn't desire to discriminate between long-lived and short-lived
 * requests. Then an option for fastify/HTTP server could be enabled to do this
 * for us.
 * HTTP Server has {@link import('http').Server.closeAllConnections},
 * which, again, forcibly destroys all connections.
 * Fastify has {@link import('fastify').FastifyServerOptions.forceCloseConnections},
 * which will call the above on instance `close()`. We could declare that in
 * our `HttpAdapter` constructor.
 */
@Plugin()
export class CleanUpLongLivedConnectionsOnShutdownPlugin {
  constructor(
    @Optional()
    // @Logger('graphql')
    @Disabled('for debugging', Logger('graphql'))
    private readonly logger: ILogger | null,
  ) {}

  track(type: string, args: TypedSubscriptionArgs<GqlContextType>) {
    const { response } = args.contextValue;
    if (!response) {
      throw new Error('No response in context');
    }
    const logProps = {
      name: args.operationName,
      args: args.variableValues,
    };
    this.logger?.debug(`Tracking ${type}`, logProps);
    const sub = this.shuttingDown$.subscribe(() => {
      this.logger?.debug(`Closing ${type} response`, logProps);

      // ⬇️️️️️️️⬇️️️️️️️⬇️️️️️️️ here is the key line
      response.raw.destroy();
      // ⬆️⬆️⬆️ here is the key line

      sub.unsubscribe();
    });
    const cleanup = () => {
      if (sub.closed) return;
      this.logger?.debug(`Done tracking ${type}`, logProps);
      sub.unsubscribe();
    };
    response.raw.on('close', cleanup);
  }

  private readonly onSubscribe: Plugin['onSubscribe'] = ({ args }) => ({
    onSubscribeResult: () => {
      // Websockets seem to understand the need to disconnect & the client ack.
      // Identified here by a lack of response in the context.
      if (!args.contextValue.response) {
        return;
      }
      this.track('subscription', args);
    },
  });

  private shuttingDown$: Subject<void>;
  private readonly onPluginInit: Plugin['onPluginInit'] = () => {
    this.shuttingDown$ = new Subject();
  };
  private readonly onDispose: Plugin['onDispose'] = () => {
    this.shuttingDown$.next();
    this.shuttingDown$.complete();
  };
}
