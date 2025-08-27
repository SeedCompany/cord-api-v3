import { Injectable } from '@nestjs/common';
import { cmpBy } from '@seedcompany/common';
import { startCase } from 'lodash';
import { type DateTime } from 'luxon';
import { MetadataDiscovery } from '~/core/discovery';
import { type BaseMigration } from './base-migration.service';
import { MigrationVersion } from './migration.decorator';

@Injectable()
export class MigrationDiscovery {
  constructor(private readonly discovery: MetadataDiscovery) {}

  async getMigrations() {
    return this.discovery
      .discover(MigrationVersion)
      .classes<BaseMigration>()
      .map(({ meta: version, instance }): DiscoveredMigration => {
        const name = instance.constructor.name.replace('Migration', '');
        instance.version = version;
        return {
          version,
          instance,
          name,
          humanName: startCase(name),
        };
      })
      .toSorted(cmpBy((d) => d.version));
  }
}

export interface DiscoveredMigration {
  version: DateTime;
  instance: BaseMigration;
  name: string;
  humanName: string;
}
