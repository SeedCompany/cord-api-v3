import { registerEnumType } from '@nestjs/graphql';
import { type JobState as BullJobState } from 'bullmq';

export enum JobState {
  // Repeat = 'repeat',
  // Wait = 'wait',
  Waiting = 'waiting',
  WaitingChildren = 'waiting-children',
  Prioritized = 'prioritized',
  // Paused = 'paused',
  Delayed = 'delayed',
  Active = 'active',
  Completed = 'completed',
  Failed = 'failed',

  Unknown = 'unknown',
}
registerEnumType(JobState, { name: 'QueueJobState' });

const _tsEnumHasAllRequired: `${JobState}` =
  undefined as unknown as BullJobState;
const _tsEnumHasNoExtra: BullJobState | 'unknown' =
  undefined as unknown as `${JobState}`;
