import { Inject } from '@nestjs/common';
import { Pg } from './pg.service';

type AsyncFn = (...args: any[]) => Promise<any>;

const PgKey = Symbol('PgForTransaction');

/**
 * Run all {@link Pg.query} calls inside a transaction with the same single client.
 *
 * Client is acquired lazily, so this will do nothing until query() is called.
 *
 * This is just a shortcut for calling {@link Pg.inTx}.
 */
export const PgTransaction =
  (): MethodDecorator =>
  <T>(
    target: any,
    methodName: string | symbol,
    theDescriptor: TypedPropertyDescriptor<T>
  ) => {
    // Use property-based injection to get access to the Pg object at a known location.
    if (target[PgKey] === undefined) {
      Inject(Pg)(target, PgKey);
      // ensure prop injection is only done once.
      target[PgKey] = null;
    }

    // @ts-expect-error cannot enforce type of decorated method to be async,
    // but we still expect it.
    const descriptor = theDescriptor as TypedPropertyDescriptor<AsyncFn>;

    // Wrap the method in a inTx call
    const origMethod = descriptor.value!;
    descriptor.value = async function (...args: any[]) {
      // @ts-expect-error this works but TS still has problems with indexing on symbols
      const pg: Pg = this[PgKey];
      return await pg.inTx(() => origMethod.apply(this, args));
    };
  };
