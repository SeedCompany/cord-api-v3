import type { UnsecuredDto } from '~/common';
import type { GTLReport, GtlReportStatus } from '../../dto';
import type { GtlReportWorkflowEvent as WorkflowEvent } from '../dto';
import type { GtlReportWorkflow } from '../gtl-report-workflow';

/**
 * A GTL report moved through its workflow. Fired inside the mutation's
 * transaction after the event is recorded and the status written. No handler
 * yet — the status-changed email is a later piece and will hang off this.
 */
export class GtlReportTransitionedHook {
  constructor(
    public report: UnsecuredDto<GTLReport>,
    readonly previousStatus: GtlReportStatus,
    readonly next:
      | (typeof GtlReportWorkflow)['resolvedTransition']
      | GtlReportStatus,
    readonly workflowEvent: UnsecuredDto<WorkflowEvent>,
  ) {}
}
