import { Injectable } from '@nestjs/common';
import { createMetadataDecorator } from '@seedcompany/nest';
import { DateTime } from 'luxon';
import type { AbstractClass } from 'type-fest';
import { type BaseMigration } from './base-migration.service';

export const DB_MIGRATION_KEY = 'ON_DB_INDEX';

export const MigrationVersion = createMetadataDecorator({
  key: DB_MIGRATION_KEY,
  setter: (isoTime: DateTime | string) =>
    DateTime.isDateTime(isoTime) ? isoTime : DateTime.fromISO(isoTime),
  types: ['class'],
  additionalDecorators: [Injectable()],
});

export const Migration =
  (isoTime: DateTime | string) =>
  <Cls extends AbstractClass<BaseMigration>>(cls: Cls) =>
    MigrationVersion(isoTime)(cls);
