import { registerEnumType } from '@nestjs/graphql';
import { type JobType as BullJobType } from 'bullmq';

export enum JobType {
  Repeat = 'repeat',
  Wait = 'wait',
  Waiting = 'waiting',
  WaitingChildren = 'waiting-children',
  Prioritized = 'prioritized',
  Paused = 'paused',
  Delayed = 'delayed',
  Active = 'active',
  Completed = 'completed',
  Failed = 'failed',
}
registerEnumType(JobType, { name: 'QueueJobType' });

const _tsEnumHasAllRequired: `${JobType}` = undefined as unknown as BullJobType;
const _tsEnumHasNoExtra: BullJobType = undefined as unknown as `${JobType}`;
