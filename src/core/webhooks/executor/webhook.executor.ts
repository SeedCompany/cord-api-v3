import { Inject, Injectable } from '@nestjs/common';
import {
  type BroadcasterTransport,
  DurableBroadcaster,
  ProxyBroadcaster,
} from '@seedcompany/nest/broadcast';
import {
  type DocumentNode,
  type ExecutionArgs,
  type ExecutionResult,
  getOperationAST,
  type GraphQLError,
} from 'graphql';
import { errorAsyncIterator, isAsyncIterable } from 'graphql-yoga';
import type { ObservableInput } from 'rxjs';
import { type GqlContextType } from '~/common';
import { Identity } from '../../authentication';
import { Broadcaster } from '../../broadcast';
import { Yoga } from '../../graphql';
import { type Webhook } from '../dto';
import { WebhookCollectChannelsTransport } from './webhook-collect-channels.transport';
import { WebhookStaticEventsTransport } from './webhook-static-events.transport';

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

  async executeWithEvents(
    webhook: Webhook,
    events: ReadonlyMap<string, ObservableInput<unknown>>,
  ) {
    const broadcaster = new WebhookStaticEventsTransport(events);
    return await this.executeWith(webhook, broadcaster);
  }

  async executeWith(webhook: Webhook, transport: BroadcasterTransport) {
    const broadcaster = new DurableBroadcaster(transport);
    return await this.broadcaster.runUsing(broadcaster, async () => {
      // Give the correct auth scope for the subscription resolver execution.
      return await this.identity.asUser(webhook.owner.id, async () => {
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

    const document: DocumentNode = envelop.parse(webhook.subscription);

    // Webhook could become invalid with schema changes.
    const errors = envelop.validate(envelop.schema, document);
    if (errors.length > 0) {
      throw new WebhookValidationError(errors);
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

    const subscribed:
      | AsyncIterable<ExecutionResult, void, void>
      | { errors: readonly GraphQLError[] } =
      // This await is just awaiting the establishing of the
      // "connection listening"/AsyncIterable
      await envelop.subscribe(args);
    if (isAsyncIterable(subscribed)) {
      return errorAsyncIterator(subscribed, (error) => {
        // Error(s) thrown during event item emission
        // This should always be an AggregateError due to our formatting plugin
        // https://github.com/SeedCompany/cord-api-v3/blob/webhooks/src/core/graphql/graphql-error-formatter.ts#L78-L78
        throw new WebhookEventEmissionError(
          error instanceof AggregateError ? error.errors : [],
        );
      });
    } else {
      // Error(s) thrown while establishing connection
      throw new WebhookSubscriptionInitializationError(subscribed.errors);
    }
  }
}

export class WebhookError extends AggregateError {}
export class WebhookValidationError extends WebhookError {}
export class WebhookEventEmissionError extends WebhookError {}
export class WebhookSubscriptionInitializationError extends WebhookError {}
