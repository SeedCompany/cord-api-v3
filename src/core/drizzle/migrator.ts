import { Injectable, type OnModuleInit } from '@nestjs/common';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'path';
import { ConfigService } from '~/core/config';
import { ILogger, Logger } from '~/core/logger';
import { DrizzleService } from './drizzle.service';

/** True when the process was launched as `console pg refresh`. */
const isPgRefreshInvocation = () => {
  const args = process.argv.slice(2);
  const pg = args.indexOf('pg');
  return pg !== -1 && args[pg + 1] === 'refresh';
};

@Injectable()
export class DrizzleMigrator implements OnModuleInit {
  @Logger('postgres:migrator') private readonly logger: ILogger;

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    if (this.config.databaseEngine !== 'postgres') return;
    // The `pg refresh` command owns wipe + migrate itself and must be able to
    // start even when a boot-time migration would fail (a broken schema is
    // exactly what it repairs). So don't auto-migrate on that command path.
    if (isPgRefreshInvocation()) return;
    await this.run();
  }

  /** Apply all pending Drizzle migrations. Safe to call repeatedly. */
  async run() {
    this.logger.info('Running PostgreSQL migrations');
    await migrate(this.drizzle.client, {
      migrationsFolder: path.join(process.cwd(), 'src/core/drizzle/migrations'),
    });
    this.logger.info('PostgreSQL migrations complete');
  }
}
