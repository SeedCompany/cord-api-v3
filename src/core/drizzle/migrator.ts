import { Injectable, type OnModuleInit } from '@nestjs/common';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'path';
import { ConfigService } from '~/core/config';
import { ILogger, Logger } from '~/core/logger';
import { DrizzleService } from './drizzle.service';
import { isPgRefreshInvocation } from './refresh/is-pg-refresh-invocation';

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
    // Said out loud, because "migrations silently did not run" is otherwise
    // indistinguishable from "migrations ran and there was nothing to do".
    if (isPgRefreshInvocation()) {
      this.logger.info(
        'Skipping startup migrations — `pg refresh` applies them itself',
      );
      return;
    }
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
