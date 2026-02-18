import { type CronOptions as BaseOptions } from 'croner';
import type { DateTime, Zone } from 'luxon';
import { type SetFieldType } from 'type-fest';
import { type DurationIn } from '~/common';
import { type Lock } from '../locker';

export type ScheduleOptions = {
  /**
   * The name of the scheduled task.
   */
  name: string;

  /**
   * The cron pattern to use or a single date/time to run once.
   */
  schedule: string | DateTime | Date;

  /**
   * Customize the lock behavior which the task runs inside to prevent multiple
   * instances of the same task from running at the same time.
   */
  lock?: Lock.Options;
} & SetFieldType<
  SetFieldType<
    SetFieldType<
      Omit<
        BaseOptions,
        // We'll require
        | 'name'
        // Use NestJS filters instead
        | 'catch'
      >,
      'interval',
      DurationIn
    >,
    'timezone',
    Zone | string
  >,
  'startAt' | 'stopAt',
  BaseOptions['startAt'] | DateTime
>;
