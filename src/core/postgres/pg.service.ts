import { Inject, Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { dropRightWhile } from 'lodash';
import pg, {
  type ClientBase,
  type PoolClient,
  type Pool as PoolType,
} from 'pg';
import { TracingService } from '../tracing';

const { Client, DatabaseError, Pool } = pg;

@Injectable()
export class Pg {
  constructor(
    @Inject(Pool) private readonly pool: PoolType,
    private readonly tracing: TracingService,
  ) {}

  /**
   * Holds the lazy client for the transaction within this async scope.
   */
  private readonly clientStore = new AsyncLocalStorage<
    () => Promise<ClientBase>
  >();

  async query<R = unknown>(
    queryText: string,
    values?: unknown[],
  ): Promise<readonly R[]> {
    // Grab transaction client creator & initialize it if needed.
    const txClient = await this.clientStore.getStore()?.();
    // Otherwise, just use implicit client from pool
    const client = txClient ?? this.pool;

    try {
      // Hack to get the callee name, to identify the tracing segment.
      const stack = new Error('').stack!.split('\n').slice(2);
      const frame = stack[0]
        ? /at (?:async )?(.+) \(/.exec(stack[0])
        : undefined;
      const calleeName =
        frame?.[1].replace(/^Pg/, '').replace(/Repository\./, '.') ?? 'Query';

      return await this.tracing.capture(calleeName, async (sub) => {
        // Show this segment separately in service map
        sub.namespace = 'remote';
        // Help ID the segment as being for a database
        sub.sql = {};

        const result = await client.query(queryText, values);
        return result.rows;
      });
    } catch (e) {
      if (e instanceof DatabaseError) {
        // Stacktrace will always be relating to received remote data,
        // completely unrelated to the callee of this method.
        // Replace it with callee of this method, so it's actually tied
        // to the code defining the query being executed.
        e.stack = [
          ...dropRightWhile(e.stack!.split('\n'), (line) =>
            line.startsWith('    at'),
          ),
          ...new Error('').stack!.split('\n').slice(2),
        ].join('\n');
      }
      throw e;
    }
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
