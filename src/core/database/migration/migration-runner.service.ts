import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ILogger, Logger } from '../../logger';
import { DatabaseService, DbTraceLayer } from '../database.service';
import {
  MigrationRegistry,
  type RegisteredMigration,
} from './migration.registry';

@Injectable()
@DbTraceLayer.applyToClass()
export class MigrationRunner {
  constructor(
    private readonly db: DatabaseService,
    private readonly registry: MigrationRegistry,
    @Logger('database:migration') private readonly logger: ILogger,
  ) {}

  async syncUp() {
    const migrations = await this.registry.getMigrations();
    await this.runMigrations(migrations);
  }

  async runMigrations(migrations: readonly RegisteredMigration[]) {
    const existing = await this.currentSchemaVersion();

    if (!existing) {
      await this.setSchemaVersion(DateTime.now());
      this.logger.info('No schema version found, assuming new database');
      return;
    }

    const migratorsToRun = migrations.filter((d) => d.version > existing);

    if (migratorsToRun.length === 0) {
      this.logger.debug('Schema is already up to date');
      return;
    }

    const latest = migrations.at(-1)?.version ?? DateTime.local();
    let current = existing;
    try {
      for (const migrator of migratorsToRun) {
        this.logger.info('Running migration', { name: migrator.humanName });
        try {
          await migrator.instance.up();
          current = migrator.version;
        } catch (e) {
          this.logger.error('Migration failed', {
            name: migrator.humanName,
            exception: e,
          });
          throw e;
        }
      }
    } finally {
      if (current > existing) {
        await this.setSchemaVersion(current);
      }
      if (current < latest) {
        this.logger.info(
          'Schema migration finished incompletely due to error(s)',
        );
      } else {
        this.logger.info('Schema is now up to date');
      }
    }
  }

  private async currentSchemaVersion() {
    const query = this.db.query();
    return await this.db.conn.runInTransaction(
      async () => {
        return await query
          .matchNode('node', 'SchemaVersion')
          .return<{ value: DateTime }>('node.value as value')
          .map('value')
          .first();
      },
      {
        queryLogger: this.logger,
      },
    );
  }

  private async setSchemaVersion(next: DateTime) {
    await this.db
      .query()
      .merge(node('node', 'SchemaVersion'))
      .setValues({ 'node.value': next })
      .return('node')
      .run();
  }
}
