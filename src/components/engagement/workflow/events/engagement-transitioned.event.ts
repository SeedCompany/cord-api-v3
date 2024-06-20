import type { UnsecuredDto } from '~/common';
import type { Engagement, EngagementStatus } from '../../dto';
import type { EngagementWorkflowEvent as WorkflowEvent } from '../dto';
import type { EngagementWorkflow } from '../engagement-workflow';

export class EngagementTransitionedEvent {
  constructor(
    readonly engagement: Engagement,
    readonly previousStep: EngagementStatus,
    readonly next:
      | (typeof EngagementWorkflow)['resolvedTransition']
      | EngagementStatus,
    readonly workflowEvent: UnsecuredDto<WorkflowEvent>,
  ) {}
}
