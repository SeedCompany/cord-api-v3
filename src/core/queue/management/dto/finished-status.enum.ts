import { registerEnumType } from '@nestjs/graphql';
import { type FinishedStatus as BullFinishedStatus } from 'bullmq';

export enum FinishedStatus {
  Completed = 'completed',
  Failed = 'failed',
}
registerEnumType(FinishedStatus, { name: 'QueueJobFinishedStatus' });

const _tsEnumHasAllRequired: `${FinishedStatus}` =
  undefined as unknown as BullFinishedStatus;
const _tsEnumHasNoExtra: BullFinishedStatus | 'unknown' =
  undefined as unknown as `${FinishedStatus}`;
