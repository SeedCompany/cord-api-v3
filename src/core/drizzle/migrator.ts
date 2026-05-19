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

    this.logger.info('Running PostgreSQL migrations');
    await migrate(this.drizzle.client, {
      migrationsFolder: path.join(process.cwd(), 'src/core/drizzle/migrations'),
    });
    this.logger.info('PostgreSQL migrations complete');
  }
}
