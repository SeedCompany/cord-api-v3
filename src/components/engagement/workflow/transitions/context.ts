import { ModuleRef } from '@nestjs/core';
import { Engagement, EngagementStatus } from '../../dto';

export interface EngagementWorkflowContext {
  engagement: Engagement;
  moduleRef: ModuleRef;
  migrationPrevStates?: EngagementStatus[];
}
