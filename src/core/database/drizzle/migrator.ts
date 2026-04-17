import { Injectable, type OnModuleInit } from '@nestjs/common';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';
import { ConfigService } from '~/core/config';
import { ILogger, Logger } from '~/core/logger';
import { DrizzleService } from './drizzle.service';

@Injectable()
export class DrizzleMigrator implements OnModuleInit {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly config: ConfigService,
    @Logger('database:drizzle') private readonly logger: ILogger,
  ) {}

  async onModuleInit() {
    if (this.config.databaseEngine === 'postgres') {
      await this.migrateToLatest();
    }
  }

  async migrateToLatest(): Promise<void> {
    // Resolve from project root so this works in both dev (ts-node) and prod (dist/)
    const migrationsFolder = path.join(
      process.cwd(),
      'src/core/database/drizzle/migrations',
    );
    this.logger.info('Running Drizzle migrations');
    await migrate(this.drizzle.db, { migrationsFolder });
    this.logger.info('Drizzle migrations complete');
  }
}
