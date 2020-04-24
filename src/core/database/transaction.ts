/* eslint-disable @typescript-eslint/unbound-method */

import { stripIndent } from 'common-tags';
import { Connection, Query, Transformer } from 'cypher-query-builder';
import { Dictionary } from 'lodash';
import { Transaction as NeoTransaction, Session } from 'neo4j-driver/types/v1';
import { Observable } from 'rxjs';
import { ILogger } from '../logger';

declare module 'cypher-query-builder/dist/typings/connection' {
  interface Connection {
    /**
     * Returns a new transaction.
     */
    transaction: () => Transaction;

    /**
     * This will create a transaction and call the given function with it.
     * The result of the function is returned.
     * Afterwards it will commit the transaction.
     * On any error the transaction will be rolled back.
     */
    withTransaction: <R>(inTx: (tx: Transaction) => Promise<R>) => Promise<R>;
  }
}

Connection.prototype.withTransaction = async function withTransaction<R>(
  this: Connection,
  inner: (tx: Transaction) => Promise<R>
): Promise<R> {
  const tx = this.transaction();
  let res: R;
  try {
    res = await inner(tx);
  } catch (e) {
    await tx.rollback();
    throw e;
  }
  await tx.commit();
  return res;
};

Connection.prototype.transaction = function transaction(this: Connection) {
  return new Transaction(this, this.transformer, (this as any).logger);
};

/** A type matching what Query actually uses from its connection parameter */
type QueryConnection = Pick<Connection, 'run' | 'stream'>;

export class Transaction implements QueryConnection {
  private session: Session | null;
  private wrapped: NeoTransaction;

  constructor(
    private readonly connection: Connection,
    private readonly transformer: Transformer,
    private readonly logger: ILogger
  ) {}

  query(): Query {
    // Query only calls `run` and `stream` from connection
    return new Query((this as any) as Connection);
  }

  /** Commit the transaction */
  async commit(): Promise<void> {
    if (!this.wrapped) {
      return;
    }
    try {
      await this.wrapped.commit();
    } finally {
      await this.close();
    }
  }

  /** Rollback the transaction */
  async rollback(): Promise<void> {
    if (!this.wrapped) {
      return;
    }
    try {
      await this.wrapped.rollback();
    } finally {
      await this.close();
    }
  }

  /**
   * Close this transaction's session.
   * This will be automatically called on commit/rollback.
   */
  async close() {
    if (this.session) {
      await new Promise((resolve) => this.session?.close(resolve));
      this.session = null;
    }
  }

  private begin(): void {
    if (this.wrapped) {
      // Keep previous transaction
      // trying to run a query on a finalized transaction should throw an error.
      return;
    }
    const session = this.connection.session();
    if (!session) {
      throw new Error('Could not open session: connection is not open.');
    }
    this.session = session;
    this.wrapped = this.session.beginTransaction();
  }

  /**
   * Runs the provided query on this transaction, regardless of which connection
   * the query was created from (if any).
   *
   * @see {Connection.run} for more details
   */
  async run<R = any>(query: Query): Promise<Array<Dictionary<R>>> {
    if (query.getClauses().length === 0) {
      throw new Error('Cannot run query: no clauses attached to the query.');
    }

    this.begin();

    const { query: q, params } = query.buildQueryObject();
    const statement = stripIndent(q);
    this.logger.debug('\n' + statement, params);

    const result = await this.wrapped.run(statement, params);

    return this.transformer.transformRecords(result.records);
  }

  /**
   * Streaming is not supported on transactions
   * This observable will immediately emit an error.
   */
  stream<R = any>(_query: Query): Observable<Dictionary<R>> {
    return new Observable((subscriber: { error: (e: Error) => void }) => {
      subscriber.error(new Error('Transactions cannot be streamed.'));
    });
  }
}
