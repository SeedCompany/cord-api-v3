import { Injectable, type OnModuleInit } from '@nestjs/common';
import { FileMigrationProvider, Migrator } from 'kysely';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ILogger, Logger } from '~/core/logger';
import { KyselyService } from './kysely.service';

@Injectable()
export class KyselyMigrator implements OnModuleInit {
  private readonly migrator: Migrator;

  constructor(
    db: KyselyService,
    @Logger('database:kysely') private readonly logger: ILogger,
  ) {
    this.migrator = new Migrator({
      db,
      provider: new FileMigrationProvider({
        fs,
        path,
        migrationFolder: path.join(
          path.dirname(fileURLToPath(import.meta.url)),
          'migrations',
        ),
      }),
    });
  }

  async onModuleInit() {
    // Auto-migrate when running against PostgreSQL, matching the Neo4j dbAutoMigrate behaviour.
    if (process.env.DATABASE === 'postgres') {
      await this.migrateToLatest();
    }
  }

  async migrateToLatest(): Promise<void> {
    const { error, results } = await this.migrator.migrateToLatest();

    for (const r of results ?? []) {
      if (r.status === 'Success') {
        this.logger.log(`Applied: ${r.migrationName}`);
      } else if (r.status === 'Error') {
        this.logger.error(`Failed: ${r.migrationName}`);
      }
    }

    if (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
}
