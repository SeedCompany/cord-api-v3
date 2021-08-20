import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { sortBy } from 'lodash';
import { DateTime } from 'luxon';
import { ConfigService } from '../../config/config.service';
import { ILogger, Logger } from '../../logger';
import { DatabaseService } from '../database.service';
import {
  DiscoveredMigration,
  MigrationDiscovery,
} from './migration-discovery.service';

@Injectable()
export class MigrationRunner {
  constructor(
    private readonly db: DatabaseService,
    private readonly discover: MigrationDiscovery,
    private readonly config: ConfigService,
    @Logger('database:migration') private readonly logger: ILogger
  ) {}

  async syncUp() {
    const discovered = await this.discover.getMigrations();
    await this.runMigrations(discovered);
  }

  async runMigrations(discovered: DiscoveredMigration[]) {
    const existing = await this.currentSchemaVersion();

    if (!existing) {
      await this.setSchemaVersion(DateTime.now());
      this.logger.info('No schema version found, assuming new database');
      return;
    }

    const migratorsToRun = sortBy(
      discovered.filter((d) => d.version > existing),
      (d) => d.version
    );

    let current = existing;
    try {
      for (const migrator of migratorsToRun) {
        this.logger.info('Running migration', { name: migrator.humanName });
        await migrator.instance.up();
        current = migrator.version;
      }
    } finally {
      if (current > existing) {
        await this.setSchemaVersion(current);
        this.logger.info('Schema is now up to date');
      } else {
        this.logger.debug('Schema is already up to date');
      }
    }
  }

  private async currentSchemaVersion() {
    return await this.db
      .query()
      .matchNode('node', 'SchemaVersion')
      .return<{ value: DateTime }>('node.value as value')
      .map('value')
      .first();
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
