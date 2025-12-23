import { Inject, Injectable } from '@nestjs/common';
import {
  type BroadcasterTransport,
  DurableBroadcaster,
  ProxyBroadcaster,
} from '@seedcompany/nest/broadcast';
import {
  type DocumentNode,
  type ExecutionArgs,
  type FormattedExecutionResult,
  getOperationAST,
} from 'graphql';
import { type GqlContextType } from '~/common';
import { Identity } from '../../authentication';
import { Broadcaster } from '../../broadcast';
import { Yoga } from '../../graphql';
import { type Webhook } from '../dto';
import { WebhookCollectChannelsTransport } from './webhook-collect-channels.transport';

@Injectable()
export class WebhookExecutor {
  constructor(
    private readonly yoga: Yoga,
    private readonly identity: Identity,
    @Inject(Broadcaster) private readonly broadcaster: ProxyBroadcaster,
  ) {
    if (!(this.broadcaster instanceof ProxyBroadcaster)) {
      throw new Error('Broadcaster must be a ProxyBroadcaster for webhooks');
    }
  }

  /**
   * Instead of declaring which channels each subscription listens to,
   * we execute the resolver with a special broadcaster that closes each channel
   * immediately and collects which ones were listened for.
   * This allows us to write imperative code match the specific subscription to
   * its broadcast channels, which could be dynamic based on user & GQL args.
   */
  async collectChannels(webhook: Webhook): Promise<readonly string[]> {
    // Use a broadcaster that only collects the channel names.
    // no publishing & no events are actually emitted.
    const broadcaster = new WebhookCollectChannelsTransport();
    await this.executeWith(webhook, broadcaster);
    return [...broadcaster.channels];
  }

  async executeWith(webhook: Webhook, transport: BroadcasterTransport) {
    const broadcaster = new DurableBroadcaster(transport);
    return await this.broadcaster.runUsing(broadcaster, async () => {
      // Give the correct auth scope for the subscription resolver execution.
      return await this.identity.asUser(webhook.owner.id, async () => {
        // todo what to do with errors?
        //  are they thrown here? emitted?
        //  can more than one be emitted or does it error and close (i think the latter)
        //  should the webhook be disabled?

        // Execute the subscription resolver.
        const subscribed = await this.subscribe(webhook);

        // This awaits all events of the iterable, which would never resolve
        // normally, as we would always be listening for more events.
        // But it does resolve, quickly, here because of our custom broadcaster.
        // The custom transports we complete the observable stream after
        // 0-1ish emissions.
        return await Array.fromAsync(subscribed);
      });
    });
  }

  private async subscribe(webhook: Webhook) {
    const envelop = this.yoga.getEnveloped();

    const document: DocumentNode = envelop.parse(webhook.document);

    // Webhook could become invalid with schema changes.
    // todo valid on-demand here, or proactively re-validate when schema changes?
    const errors = envelop.validate(envelop.schema, document);
    if (errors.length > 0) {
      throw new AggregateError(errors, 'Webhook operation is now invalid');
    }

    const args: ExecutionArgs = {
      document,
      operationName: webhook.name,
      variableValues: webhook.variables,

      schema: envelop.schema,
      rootValue: {},
      contextValue: await envelop.contextFactory({
        webhook,
        operation: getOperationAST(document, webhook.name)!,
      } satisfies GqlContextType),
    };

    // This await is just awaiting the establishing of the
    // "connection listening"/AsyncIterable
    const subscribed: AsyncIterable<FormattedExecutionResult, void, void> =
      await envelop.subscribe(args);

    return subscribed;
  }
}
