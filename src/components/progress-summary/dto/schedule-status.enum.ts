import { registerEnumType } from '@nestjs/graphql';

export enum ScheduleStatus {
  Ahead = 'Ahead',
  OnTime = 'OnTime',
  Behind = 'Behind',
}

export const fromVariance = (variance: number) => {
  if (variance > 1 || variance < -1) {
    throw new Error('Variance should be a decimal between [-1, 1]');
  }
  return variance > 0.3
    ? ScheduleStatus.Ahead
    : variance < -0.1
    ? ScheduleStatus.Behind
    : ScheduleStatus.OnTime;
};

registerEnumType(ScheduleStatus, {
  name: 'ScheduleStatus',
});
