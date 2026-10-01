import { Inject } from '@nestjs/common';
import { TransactionRunner } from './transaction-runner';

type AsyncFn = (...args: any[]) => Promise<any>;

const RunnerKey = Symbol('DbTransactionRunner');

/**
 * Ensure the method is ran in a transaction.
 * If a transaction has already been established, then this will continue
 * inside of that one.
 * Note that code can be executed multiple times when retrying transient errors.
 * The code executed should be idempotent.
 *
 * The transaction is established through {@link TransactionRunner}.
 */
export function Transactional() {
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

    // Wrap the method in a transaction
    const origMethod = descriptor.value!;
    descriptor.value = async function (...args: any[]) {
      // @ts-expect-error this works but TS still has problems with indexing on symbols
      const runner: TransactionRunner = this[RunnerKey];
      return await runner.inTx(() => origMethod.apply(this, args));
    };
  }) as MethodDecorator;
}
