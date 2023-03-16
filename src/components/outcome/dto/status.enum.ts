import { registerEnumType } from '@nestjs/graphql';

export enum OutcomeStatus {
  NotStarted = 'NotStarted',
  InProgress = 'InProgress',
  Completed = 'Completed',
  Cancelled = 'Cancelled',
}

registerEnumType(OutcomeStatus, {
  name: 'OutcomeStatus',
  description: 'The status of an outcome',
});
