import { Injectable, type OnModuleInit } from '@nestjs/common';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'path';
import { ConfigService } from '~/core/config';
import { ILogger, Logger } from '~/core/logger';
import { DrizzleService } from './drizzle.service';

@Injectable()
export class DrizzleMigrator implements OnModuleInit {
  @Logger('postgres:migrator') private readonly logger: ILogger;

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    if (this.config.databaseEngine !== 'postgres') return;
    await this.run();
  }

  /** Apply all pending Drizzle migrations. Safe to call repeatedly. */
  async run() {
    this.logger.info('Running PostgreSQL migrations');
    // NOTE: our migrations are hand-written, but drizzle's migrator only runs
    // files listed in `migrations/meta/_journal.json`. Adding a .sql file
    // without a matching journal entry silently applies nothing — add both.
    await migrate(this.drizzle.client, {
      migrationsFolder: path.join(process.cwd(), 'src/core/drizzle/migrations'),
    });
    this.logger.info('PostgreSQL migrations complete');
  }
}
