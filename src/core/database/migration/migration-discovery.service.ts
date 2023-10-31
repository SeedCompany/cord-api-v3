import { DiscoveryService } from '@golevelup/nestjs-discovery';
import { Injectable } from '@nestjs/common';
import { sortBy } from '@seedcompany/common';
import { startCase } from 'lodash';
import { DateTime } from 'luxon';
import { BaseMigration } from './base-migration.service';
import { DB_MIGRATION_KEY } from './migration.decorator';

@Injectable()
export class MigrationDiscovery {
  constructor(private readonly discover: DiscoveryService) {}

  async getMigrations() {
    const discovered = await this.discover.providersWithMetaAtKey<DateTime>(
      DB_MIGRATION_KEY,
    );
    const mapped = discovered.map((d): DiscoveredMigration => {
      const instance = d.discoveredClass.instance as BaseMigration;
      const name = instance.constructor.name.replace('Migration', '');
      instance.version = d.meta;
      return {
        version: d.meta,
        instance: instance,
        name: name,
        humanName: startCase(name),
      };
    });
    return sortBy(mapped, (d) => d.version);
  }
}

export interface DiscoveredMigration {
  version: DateTime;
  instance: BaseMigration;
  name: string;
  humanName: string;
}
