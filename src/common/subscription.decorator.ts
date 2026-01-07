import { applyDecorators } from '@nestjs/common';
import {
  type ReturnTypeFunc,
  // eslint-disable-next-line @seedcompany/no-restricted-imports
  Subscription as SubscriptionMetadata,
  type SubscriptionOptions,
} from '@nestjs/graphql';
import { type MaybeAsync } from '@seedcompany/common';
import { type Observable } from 'rxjs';
import type { AbstractClass } from 'type-fest';

/**
 * Subscription handler (method) Decorator. Routes subscriptions to this method.
 *
 * Note that Observables are allowed with a patch we have to Nest core:
 * ./core/graphql/normalize-subscription-output.ts
 */
export const Subscription =
  <Cls extends AbstractClass<any>, T = InstanceType<Cls>>(
    typeFunc: ReturnTypeFunc<Cls>,
    // Hide filter & resolve, do all of that in the method body.
    options?: Omit<SubscriptionOptions, 'filter' | 'resolve'>,
  ) =>
  <R extends MaybeAsync<Observable<T> | AsyncIterable<T>>>(
    staticClass: any,
    methodName: string | symbol,
    descriptor: TypedPropertyDescriptor<(...args: any[]) => R>,
  ) =>
    applyDecorators(
      SubscriptionMetadata(typeFunc, {
        // This is needed to wrap the payload in an object under the subscription name
        // { mySubscription: payload }
        // Without this, it has to be done manually, which is head scratching.
        resolve: (payload) => payload,
        ...options,
      }),
    )(staticClass, methodName, descriptor);
