import { type EnumType, makeEnum } from '~/common';

export type ScheduleStatus = EnumType<typeof ScheduleStatus>;
export const ScheduleStatus = makeEnum({
  name: 'ScheduleStatus',
  values: ['Behind', 'OnTime', 'Ahead'],
  exposeOrder: true,
  extra: (status) => ({
    fromVariance: (variance: number) => {
      if (variance > 1 || variance < -1) {
        throw new Error('Variance should be a decimal between [-1, 1]');
      }
      // Variance thresholds are based on the
      // FLD Job Aid in the Field Ops Sharepoint Library
      // https://seedcompany.sharepoint.com/:b:/s/FieldOpsServices/IQB_9wOt6i_YTZ1ywO1zJArGAVfY-_8KEHR08WaiUKlcZh4?e=kZmwYz
      // Behind/Delayed: < -10%
      // On Time: -10% to +30%
      // Ahead of Schedule: > +30%
      // The ScheduleStatus determines if an explanation
      // is required for the IRP progress report.
      return variance > 0.3
        ? status.Ahead
        : variance < -0.1
          ? status.Behind
          : status.OnTime;
    },
  }),
});
