import { EnumType, makeEnum } from '~/common';

export type ScheduleStatus = EnumType<typeof ScheduleStatus>;
export const ScheduleStatus = makeEnum({
  name: 'ScheduleStatus',
  values: ['Ahead', 'OnTime', 'Behind'],
  extra: (status) => ({
    fromVariance: (variance: number) => {
      if (variance > 1 || variance < -1) {
        throw new Error('Variance should be a decimal between [-1, 1]');
      }
      return variance > 0.1
        ? status.Ahead
        : variance < -0.1
        ? status.Behind
        : status.OnTime;
    },
  }),
});
