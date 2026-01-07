import { InterceptorsConsumer } from '@nestjs/core/interceptors';
import { isObjectLike, patchMethod } from '@seedcompany/common';
import { toAsyncIterable } from '@seedcompany/nest';
import {
  // eslint-disable-next-line @seedcompany/no-unused-vars -- in docs
  type Observable,
  of,
  type Subscribable,
} from 'rxjs';
import { type GqlContextType } from '~/common';

/**
 * Normalize GraphQL Subscription resolver returns
 * from {@link Observable} to an {@link AsyncIterable}.
 *
 * From what I can tell GraphQL chose {@link AsyncIterable}
 * because it has been standardized and {@link Observable} has not.
 * But {@link AsyncIterable} has many pitfalls that can lead to memory leaks,
 * and I would bet there are regrets about that decision.
 * Yoga even recommends using {@link import('graphql-yoga').Repeater} instead.
 * https://repeater.js.org/docs/rationale/
 *
 * In practice repeaters and their helpers look so similar to observables.
 * Both have constructors with callback logic, pipes, map, and filter functions.
 *
 * So this allows us to just use observables, if desired.
 * Hopefully providing a more consistent experience.
 */
patchMethod(InterceptorsConsumer.prototype, 'intercept', (base) => {
  return (...args) => {
    const [interceptors, exeArgs, instance, callback, next, type] = args;
    if (
      type === 'graphql' &&
      (exeArgs[2] as GqlContextType).operation.operation === 'subscription'
    ) {
      const patchedNext = async () => {
        const res = await next();
        return normalizeResult(res);
      };
      return base(interceptors, exeArgs, instance, callback, patchedNext, type);
    }
    return base(...args);
  };
});

function normalizeResult(val: unknown) {
  const observable = asSubscribable(val);
  if (!observable) {
    return val;
  }
  const normalized = makePushPull(observable);
  /**
   * InterceptorsConsumer unwraps Observables as if they were an async single value.
   * https://docs.nestjs.com/controllers#asynchronicity
   * This probably stems from its foundations from Angular,
   * which is based on RxJS and had many services returning observables.
   * So NestJS tries to be helpful and accept observables directly,
   * so you don't have to convert them to promises yourself.
   *
   * So this doesn't work when we actually want observables emitting multiple values.
   * We don't want NestJS to unwrap the observable as a single promised single value.
   *
   * So we wrap our "events"-observable in another "resolver"-observable emitting
   * just only the former.
   */
  return of(normalized);
}

/**
 * Patch the Observable instance to also be AsyncIterable.
 * This allows GQL driver code to consume its stream of events.
 * This maintains the signature of the resolver, but I'm not sure if this
 * is necessary at this point, since here we are already in middleware land.
 */
const makePushPull = <T>(
  observable: Subscribable<T>,
): Subscribable<T> & AsyncIterable<T> => {
  const pull: AsyncIterable<T> = {
    [Symbol.asyncIterator]: () => toAsyncIterable(observable),
  };
  return Object.assign(observable, pull);
};

const asSubscribable = <R = unknown>(
  val: unknown,
): Subscribable<R> | undefined =>
  isObjectLike(val) &&
  observable in val &&
  typeof val[observable] === 'function'
    ? val[observable]()
    : undefined;

// Despite rxjs typing this, it is not a native symbol yet.
const observable: typeof Symbol.observable = '@@observable' as any;
