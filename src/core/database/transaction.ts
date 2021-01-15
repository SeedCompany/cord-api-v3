import { Connection } from 'cypher-query-builder';
import { MsDurationInput, parseMilliseconds } from '../../common';
import { PatchedConnection } from './cypher.factory';

export interface TransactionOptions {
  mode?: 'read' | 'write';
  timeout?: MsDurationInput;
}

declare module 'cypher-query-builder/dist/typings/connection' {
  interface Connection {
    /**
     * This will create a transaction and call the given function with it.
     * The result of the function is returned.
     * Afterwards it will commit the transaction.
     * On any error the transaction will be rolled back.
     *
     * Normal db query methods inside of this function call will be applied
     * to the transaction.
     */
    runInTransaction: <R>(
      inTx: (this: void) => Promise<R>,
      options?: TransactionOptions
    ) => Promise<R>;
  }
}

Connection.prototype.runInTransaction = async function withTransaction<R>(
  this: PatchedConnection,
  inner: (this: void) => Promise<R>,
  options?: TransactionOptions
): Promise<R> {
  const outer = this.transactionStorage.getStore();
  if (outer) {
    return await inner();
  }
  const session = this.session();
  if (!session) {
    throw new Error('Cannot run query because connection is not open.');
  }

  const runTransaction =
    options?.mode === 'read'
      ? session.readTransaction.bind(session)
      : session.writeTransaction.bind(session);

  try {
    return await runTransaction(
      (tx) => this.transactionStorage.run(tx, inner),
      {
        timeout: options?.timeout
          ? parseMilliseconds(options.timeout)
          : undefined,
      }
    );
  } finally {
    await session.close();
  }
};
