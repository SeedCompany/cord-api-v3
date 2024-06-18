import { Granter } from '../../authorization';
import { WorkflowEventGranter } from '../../workflow/workflow.granter';
import { EngagementWorkflowEvent as Event } from './dto';
import { EngagementWorkflow } from './engagement-workflow';

@Granter(Event)
export class EngagementWorkflowEventGranter extends WorkflowEventGranter(
  () => EngagementWorkflow,
) {}

declare module '../../authorization/policy/granters' {
  interface GrantersOverride {
    EngagementWorkflowEvent: EngagementWorkflowEventGranter;
  }
}
