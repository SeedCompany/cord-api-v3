import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { ConfigService } from '~/core/config';
import * as schema from './schema/index';

export type DrizzleDb = NodePgDatabase<typeof schema>;

@Injectable()
export class DrizzleService implements OnModuleDestroy {
  private readonly baseDb: DrizzleDb;
  private readonly als = new AsyncLocalStorage<DrizzleDb>();
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    const url = config.postgres.url;
    if (!url) {
      if (config.databaseEngine === 'postgres') {
        throw new Error('POSTGRES_URL is required when DATABASE=postgres');
      }
      return;
    }
    this.pool = new Pool({ connectionString: url });
    this.baseDb = drizzle(this.pool, { schema });
  }

  get client(): DrizzleDb {
    const client = this.als.getStore() ?? this.baseDb;
    if (!client)
      throw new Error(
        'DrizzleService.client accessed but DATABASE is not postgres',
      );
    return client;
  }

  /**
   * Whether this async context is already running inside a transaction.
   *
   * Callers that decide whether to open one need this: nothing about a Drizzle
   * client tells you which of the two it is, since {@link client} silently
   * falls back to the pool.
   */
  get inTransaction(): boolean {
    return !!this.als.getStore();
  }

  /**
   * Run `fn` inside a transaction, continuing one that is already open rather
   * than starting a second.
   *
   * The continuation is not a nicety. Without it a nested call takes ANOTHER
   * connection out of the pool and begins a transaction that commits and rolls
   * back independently — so an inner write survives an outer rollback, and each
   * nested call holds two pool connections at once, which deadlocks the pool
   * under concurrency rather than failing. Neo4j's equivalent has always
   * continued (`runInTransaction` returns the inner call directly when a
   * transaction is open), so this also keeps the engines behaving the same.
   */
  async inTx<R>(fn: () => Promise<R>): Promise<R> {
    if (this.inTransaction) {
      return await fn();
    }
    return await this.baseDb.transaction((tx) =>
      this.als.run(tx as DrizzleDb, fn),
    );
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }
}
