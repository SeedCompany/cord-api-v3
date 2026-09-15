import { type ID, type UnsecuredDto } from '~/common';
import { type ProgressReportStatus as Status } from '../../dto';
import { type ProgressReportWorkflowEvent as WorkflowEvent } from '../dto/workflow-event.dto';
import { type InternalTransition } from '../transitions';

export class WorkflowUpdatedHook {
  constructor(
    readonly reportId: ID,
    readonly previousStatus: Status,
    readonly next: InternalTransition | Status,
    readonly workflowEvent: UnsecuredDto<WorkflowEvent>,
    /**
     * When an automated process (not a person) executed the transition,
     * a human-readable phrase for why, e.g.
     * "report data was received from Rev79".
     */
    readonly automatedReason?: string,
  ) {}
}
