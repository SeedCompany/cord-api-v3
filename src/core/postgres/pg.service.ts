import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { Client, ClientBase, Pool, PoolClient } from 'pg';

@Injectable()
export class Pg {
  constructor(private readonly pool: Pool) {}

  /**
   * Holds the lazy client for the transaction within this async scope.
   */
  private readonly clientStore = new AsyncLocalStorage<
    () => Promise<ClientBase>
  >();

  async query<R = unknown>(
    queryText: string,
    values?: unknown[]
  ): Promise<readonly R[]> {
    // Grab transaction client creator & initialize it if needed.
    const client = await this.clientStore.getStore()?.();
    // Otherwise, just use implicit client from pool
    const result = await (client ?? this.pool).query<R>(queryText, values);
    return result.rows;
  }

  /**
   * Prefer {@link PgTransaction @PgTransaction()} decorator to this explicit method.
   *
   * Run given function inside a transaction.
   *
   * If called inside another transaction, this will re-use that transaction,
   * NOT make another one.
   *
   * Client is lazily acquired and tracked for you,
   * all you have to do is call {@link query}.
   *
   * BEGIN/COMMIT commands are sent automatically before and after given function.
   * ABORT is sent automatically when an exception is thrown, so be sure to
   * not swallow errors inside this function call.
   */
  async inTx<R>(run: () => Promise<R>): Promise<R> {
    if (this.clientStore.getStore()) {
      // Already have a bound client, this is noop.
      return await run();
    }

    // Create function to lazily acquire client once.
    let client: PoolClient | null = null;
    const getClient = async () => {
      if (!client) {
        client = await this.pool.connect();
        await client.query('BEGIN');
      }
      return client;
    };
    // TS has a false positive here, re-enforce it's possible to not be null.
    client = client as PoolClient | null;

    try {
      // Run given function bound to this lazy client
      const result = await this.clientStore.run(getClient, run);
      await client?.query('COMMIT');
      return result;
    } catch (e) {
      await client?.query('ROLLBACK');
      throw e;
    } finally {
      client?.release();
    }
  }

  escapeIdentifier(str: string): string {
    return Client.prototype.escapeIdentifier(str);
  }
  escapeLiteral(str: string): string {
    return Client.prototype.escapeLiteral(str);
  }
}
