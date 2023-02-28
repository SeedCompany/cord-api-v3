import { Connection } from 'cypher-query-builder';
import { Duration, DurationLike } from 'luxon';
import { Transaction as NeoTransaction } from 'neo4j-driver';
import { ServerException } from '../../common';
import { ILogger } from '../logger';
import { PatchedConnection } from './cypher.factory';

export type Transaction = NeoTransaction & { queryLogger?: ILogger };

/**
 * A neo4j transaction mode
 */
export const enum TxMode {
  Read = 'read',
  Write = 'write',
}

export interface TransactionOptions {
  /**
   * Should this method start a read or write transaction?
   * `write` is default.
   * Note that a write transaction cannot be called from within a read transaction.
   */
  mode?: TxMode;

  /**
   * The transaction's timeout.
   *
   * Transactions that execute longer than the configured timeout will be
   * terminated by the database. This functionality allows to limit
   * query/transaction execution time.
   *
   * Specified timeout overrides the default timeout configured in configured
   * in the database using `dbms.transaction.timeout` setting.
   */
  timeout?: DurationLike;

  /**
   * The transaction's metadata.
   *
   * Specified metadata will be attached to the executing transaction and visible
   * in the output of `dbms.listQueries` and `dbms.listTransactions` procedures.
   * It will also get logged to the `query.log`.
   */
  metadata?: Record<string, unknown>;

  queryLogger?: ILogger;
}

declare module 'cypher-query-builder/dist/typings/connection' {
  interface Connection {
    /**
     * The currently active transaction within the current calling context.
     * Use of this is discouraged.
     */
    currentTransaction: Transaction | undefined;

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
      options?: TransactionOptions,
    ) => Promise<R>;
  }
}

Object.defineProperty(Connection.prototype, 'currentTransaction', {
  get: function (this: PatchedConnection) {
    return this.transactionStorage.getStore();
  },
});

Connection.prototype.runInTransaction = async function withTransaction<R>(
  this: PatchedConnection,
  inner: (this: void) => Promise<R>,
  options?: TransactionOptions,
): Promise<R> {
  const outer = this.currentTransaction;
  if (outer) {
    // @ts-expect-error not typed, but js is there.
    const isExistingRead = outer._connectionHolder._mode === 'READ';
    if (isExistingRead && options?.mode !== 'read') {
      throw new ServerException(
        'A write transaction cannot be started within a read transaction',
      );
    }

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
      (tx) => {
        if (options?.queryLogger) {
          (tx as Transaction).queryLogger = options?.queryLogger;
        }
        return this.transactionStorage.run(tx, inner);
      },
      {
        timeout: options?.timeout
          ? Duration.from(options.timeout).toMillis()
          : undefined,
        metadata: options?.metadata,
      },
    );
  } finally {
    await session.close();
  }
};
