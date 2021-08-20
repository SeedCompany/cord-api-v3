import { applyDecorators, Injectable, SetMetadata } from '@nestjs/common';
import { DateTime } from 'luxon';

export const DB_MIGRATION_KEY = 'ON_DB_INDEX';

export const Migration = (isoTime: string) => {
  const dt = DateTime.fromISO(isoTime); // TODO validate, better error
  return applyDecorators(Injectable(), SetMetadata(DB_MIGRATION_KEY, dt));
};
