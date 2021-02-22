// eslint-disable-next-line no-restricted-imports -- This is the one spot we actually need it
import { Subscription as BaseSubscription } from '@nestjs/graphql';
import { SubscriptionOptions } from '@nestjs/graphql/dist/decorators/subscription.decorator';
import { ReturnTypeFunc } from '@nestjs/graphql/dist/interfaces';

export const Subscription = (
  typeFunc: ReturnTypeFunc,
  options?: SubscriptionOptions
) =>
  BaseSubscription(typeFunc, {
    // This is needed to wrap the payload in an object under the subscription name
    // { mySubscription: payload }
    // Without this, it has to be done manually, which is head scratching and inconsistent.
    resolve: (payload) => payload,
    ...options,
  });
