import { BroadcasterTransport } from '@seedcompany/nest/broadcast';
import { type TransactionHooks } from '../database';
import { type GqlContextHost } from '../graphql';
import type { BroadcastChannel } from './index';

/**
 * Transport that defers the actual publishing until the end of the current
 * GraphQL mutation/transaction, if in one.
 */
export class TransactionDeferredTransport extends BroadcasterTransport {
  constructor(
    private readonly transport: BroadcasterTransport,
    private readonly txHooks: TransactionHooks,
    private readonly gqlContextHost: GqlContextHost,
  ) {
    super();
  }

  observe(channel: BroadcastChannel) {
    return this.transport.observe(channel);
  }

  publish(channel: BroadcastChannel, data: unknown) {
    const op = this.gqlContextHost.contextMaybe?.operation;
    if (op && op.operation === 'mutation') {
      this.txHooks.afterCommit.add(() => {
        this.transport.publish(channel, data);
      });
      return;
    }
    this.transport.publish(channel, data);
  }
}
