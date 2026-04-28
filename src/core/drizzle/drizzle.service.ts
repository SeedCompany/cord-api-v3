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

  get db(): DrizzleDb {
    const db = this.als.getStore() ?? this.baseDb;
    if (!db)
      throw new Error(
        'DrizzleService.db accessed but DATABASE is not postgres',
      );
    return db;
  }

  async inTx<R>(fn: () => Promise<R>): Promise<R> {
    return await this.baseDb.transaction((tx) =>
      this.als.run(tx as DrizzleDb, fn),
    );
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }
}
