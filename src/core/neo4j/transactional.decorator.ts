import { Inject } from '@nestjs/common';
import { TransactionRunner } from '~/core/database/transaction-runner';
import { type TransactionOptions } from './transaction';

type AsyncFn = (...args: any[]) => Promise<any>;

const RunnerKey = Symbol('DbTransactionRunner');

/**
 * Ensure the method is ran in a transaction.
 * If a transaction has already been established, then this will continue
 * inside of that one.
 * Note that code can be executed multiple times when retrying transient errors.
 * The code executed should be idempotent.
 *
 * The transaction is established on whichever database engine is active — see
 * {@link TransactionRunner}. This previously injected the Neo4j `Connection`
 * directly, which meant decorated methods hit Neo4j regardless of `DATABASE`,
 * bypassing `splitDb`.
 */
export function Transactional(options?: TransactionOptions) {
  return ((
    target: any,
    methodName: string | symbol,
    descriptor: TypedPropertyDescriptor<AsyncFn>,
  ) => {
    // Use property-based injection to get access to the runner at a known
    // location.
    if (target[RunnerKey] === undefined) {
      Inject(TransactionRunner)(target, RunnerKey);
      // ensure prop injection is only done once.
      target[RunnerKey] = null;
    }

    const clsName: string = target.constructor.name;
    const methodDescription =
      typeof methodName === 'symbol'
        ? (methodName.description ?? 'symbol')
        : methodName;
    const initiator = `${clsName}.${methodDescription}`;

    // Wrap the method in a transaction
    const origMethod = descriptor.value!;
    descriptor.value = async function (...args: any[]) {
      // @ts-expect-error this works but TS still has problems with indexing on symbols
      const runner: TransactionRunner = this[RunnerKey];
      return await runner.inTx(() => origMethod.apply(this, args), {
        ...options,
        metadata: {
          initiator,
          ...options?.metadata,
        },
      });
    };
  }) as MethodDecorator;
}
