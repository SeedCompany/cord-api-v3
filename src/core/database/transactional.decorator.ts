import { Inject } from '@nestjs/common';
import { Connection } from 'cypher-query-builder';
import { TransactionOptions } from './transaction';

type AsyncFn = (...args: any[]) => Promise<any>;

const ConnKey = Symbol('DbConnectionForTransactions');

/**
 * Ensure the method is ran in a transaction.
 * If a transaction has already been established, then this will continue
 * inside of that one.
 * Note that code can be executed multiple times when retrying transient errors.
 * The code executed should be idempotent.
 *
 * This is just a shortcut for calling `Connection.runInTransaction()`.
 */
export function Transactional(options?: TransactionOptions) {
  return ((
    target: any,
    methodName: string | symbol,
    descriptor: TypedPropertyDescriptor<AsyncFn>,
  ) => {
    // Use property-based injection to get access to the db connection object
    // at a known location.
    if (target[ConnKey] === undefined) {
      Inject(Connection)(target, ConnKey);
      // ensure prop injection is only done once.
      target[ConnKey] = null;
    }

    const clsName: string = target.constructor.name;
    const methodDescription =
      typeof methodName === 'symbol'
        ? methodName.description ?? 'symbol'
        : methodName;
    const initiator = `${clsName}.${methodDescription}`;

    // Wrap the method in a runInTransaction call
    const origMethod = descriptor.value!;
    descriptor.value = async function (...args: any[]) {
      // @ts-expect-error this works but TS still has problems with indexing on symbols
      const connection: Connection = this[ConnKey];
      return await connection.runInTransaction(
        () => origMethod.apply(this, args),
        {
          ...options,
          metadata: {
            initiator,
            ...options?.metadata,
          },
        },
      );
    };
  }) as MethodDecorator;
}
