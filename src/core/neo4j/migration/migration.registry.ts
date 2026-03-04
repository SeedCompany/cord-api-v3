import {
  Injectable,
  type OnApplicationBootstrap,
  type OnModuleInit,
} from '@nestjs/common';
import { Case } from '@seedcompany/common/case';
import { PrioritySet } from '@seedcompany/nest';
import { type DateTime } from 'luxon';
import { MetadataDiscovery } from '~/core/discovery';
import { type BaseMigration as Migration } from './base-migration.service';
import { MigrationVersion } from './migration.decorator';

@Injectable()
export class MigrationRegistry implements OnModuleInit, OnApplicationBootstrap {
  protected migrations = new PrioritySet<RegisteredMigration>();
  protected bootstrapped = false;

  constructor(private readonly discovery: MetadataDiscovery) {}

  async getMigrations() {
    return [...this.migrations];
  }

  register(migration: Migration, version?: DateTime) {
    if (this.bootstrapped) {
      throw new Error(
        'Can only register migrations before application bootstrap',
      );
    }

    const name = migration.constructor.name.replace('Migration', '');
    if (version) {
      migration.version = version;
    } else {
      version = migration.version;
      if (!version) {
        throw new Error(`Migration ${name} has no version`);
      }
    }

    this.migrations.add(
      {
        version,
        instance: migration,
        name,
        humanName: Case.capital(name),
      },
      +version,
    );
  }

  onModuleInit() {
    const discovered = this.discovery
      .discover(MigrationVersion)
      .classes<Migration>();
    for (const { meta: version, instance } of discovered) {
      this.register(instance, version);
    }
  }

  onApplicationBootstrap() {
    this.bootstrapped = true;
  }
}

export interface RegisteredMigration {
  version: DateTime;
  instance: Migration;
  name: string;
  humanName: string;
}
