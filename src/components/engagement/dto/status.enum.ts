import { registerEnumType } from '@nestjs/graphql';

export enum EngagementStatus {
  Active = 'Active',
  Completed = 'Completed',
  Converted = 'Converted',
  InDevelopment = 'InDevelopment',
  Rejected = 'Rejected',
  Suspended = 'Suspended',
  Terminated = 'Terminated',
  Unapproved = 'Unapproved',
  NotRenewed = 'NotRenewed', // Ken says not used
  AwaitingDedication = 'AwaitingDedication', // Ken says not used
  Transferred = 'Transferred',
}

registerEnumType(EngagementStatus, {
  name: 'EngagementStatus',
});
