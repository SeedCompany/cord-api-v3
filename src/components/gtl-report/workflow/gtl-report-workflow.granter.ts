import { Granter } from '../../authorization';
import { WorkflowEventGranter } from '../../workflow/workflow.granter';
import { GtlReportWorkflowEvent as Event } from './dto';
import { GtlReportWorkflow } from './gtl-report-workflow';

@Granter(Event)
export class GtlReportWorkflowEventGranter extends WorkflowEventGranter(
  () => GtlReportWorkflow,
) {}

declare module '../../authorization/policy/granters' {
  interface GrantersOverride {
    GtlReportWorkflowEvent: GtlReportWorkflowEventGranter;
  }
}
