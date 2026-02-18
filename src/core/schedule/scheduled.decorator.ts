import { createMetadataDecorator } from '@seedcompany/nest';
import { type Cron } from 'croner';
import { type ScheduleOptions } from './schedule.options';

export const Scheduled = createMetadataDecorator({
  types: ['method'],
  setter: (options: ScheduleOptions) => options,
});

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Scheduled {
  export type Options = ScheduleOptions;
  export type Task = Cron;
}
