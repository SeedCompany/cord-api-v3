import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import { ConfigService } from '~/core/config';
import type { Database } from './types';

@Injectable()
export class KyselyService extends Kysely<Database> implements OnModuleDestroy {
  constructor(config: ConfigService) {
    super({
      dialect: new PostgresDialect({
        pool: new pg.Pool({ connectionString: config.postgresUrl }),
      }),
    });
  }

  async onModuleDestroy() {
    await this.destroy();
  }
}
