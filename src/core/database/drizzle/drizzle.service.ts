import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { ConfigService } from '~/core/config';
import * as schema from './schema/index.js';

export type DrizzleDb = NodePgDatabase<typeof schema>;

@Injectable()
export class DrizzleService implements OnModuleDestroy {
  readonly db: DrizzleDb;
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
    this.db = drizzle(this.pool, { schema });
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }
}
