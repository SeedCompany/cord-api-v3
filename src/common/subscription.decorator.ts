import { applyDecorators } from '@nestjs/common';
import {
  type ReturnTypeFunc,
  // eslint-disable-next-line @seedcompany/no-restricted-imports
  Subscription as SubscriptionMetadata,
  type SubscriptionOptions,
} from '@nestjs/graphql';
import {
  type FnLike,
  isObjectLike,
  type MaybeAsync,
} from '@seedcompany/common';
import { toAsyncIterable } from '@seedcompany/nest';
import { isPromise } from 'node:util/types';
import type { Observable, Subscribable } from 'rxjs';

// Despite rxjs typing this, it is not a native symbol yet.
const observable: typeof Symbol.observable = '@@observable' as any;

/**
 * Subscription handler (method) Decorator. Routes subscriptions to this method.
 */
export const Subscription =
  <T>(
    typeFunc: ReturnTypeFunc,
    // Hide filter & resolve, do all of that in the method body.
    options?: Omit<SubscriptionOptions, 'filter' | 'resolve'>,
  ) =>
  <R extends MaybeAsync<Observable<T> | AsyncIterable<T>>>(
    staticClass: any,
    methodName: string | symbol,
    descriptor: TypedPropertyDescriptor<(...args: any[]) => R>,
  ) =>
    applyDecorators(
      NormalizeResult,
      SubscriptionMetadata(typeFunc, {
        // This is needed to wrap the payload in an object under the subscription name
        // { mySubscription: payload }
        // Without this, it has to be done manually, which is head scratching.
        resolve: (payload) => payload,
        ...options,
      }),
    )(staticClass, methodName, descriptor);

/**
 * Applies {@link normalizeResult}
 */
const NormalizeResult: MethodDecorator = (_, _n, descriptor) => {
  const prev = descriptor.value! as FnLike;
  descriptor.value = function (this: any, ...args: any) {
    return normalizeResult(prev.apply(this, args));
  } as any;
};

/**
 * Normalize {@link Observable} to an {@link AsyncIterable}.
 *
 * From what I can tell GraphQL chose {@link AsyncIterable}
 * because it has been standardized and {@link Observable} has not.
 * But AsyncIterable has many pitfalls that can lead to memory leaks,
 * and I would bet there are regrets about that decision.
 * So Yoga recommends using {@link import('graphql-yoga').Repeater} instead.
 * https://repeater.js.org/docs/rationale/
 *
 * In practice repeaters and their helpers look so similar to observables.
 * Both have constructors with callback logic, pipes, map & filter functions.
 *
 * So this allows us to just use observables, if desired.
 * Hopefully providing a more consistent experience.
 *
 * ----------------------------------------------------------------------------
 *
 * From my testing this has to be applied here in the _handler_ method.
 * NestJS proceeds to wrap this in its ExternalContext logic to apply its
 * lifecycle hooks (interceptors, etc).
 * That process unwraps Observables as if they were an async single value.
 * https://docs.nestjs.com/controllers#asynchronicity
 * This probably stems from its foundations from Angular, which is based on RxJS
 * and had many services returning observables.
 * So NestJS tries to be helpful and accept observables directly,
 * so you don't have to convert them to promises yourself.
 *
 * So this doesn't work when we actually want observables emitting multiple values.
 * We don't want NestJS to unwrap the observable a promised single value.
 *
 * Even if we could somehow configure the driver to accept observables,
 * we would still have this problem.
 * In that case, though, this code could change to double wrapping
 * the observable in another observable.
 */
function normalizeResult(res: unknown) {
  return (isPromise(res) ? res : Promise.resolve(res)).then((val: unknown) => {
    const observable = asSubscribable(val);
    if (observable) {
      return toAsyncIterable(observable);
    }
    return val;
  });
}

const asSubscribable = <R = unknown>(
  val: unknown,
): Subscribable<R> | undefined =>
  isObjectLike(val) &&
  observable in val &&
  typeof val[observable] === 'function'
    ? val[observable]()
    : undefined;
