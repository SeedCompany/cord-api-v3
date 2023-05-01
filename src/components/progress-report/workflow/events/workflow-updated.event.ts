import { ID, UnsecuredDto } from '~/common';
import { ProgressReportStatus as Status } from '../../dto';
import { ProgressReportWorkflowEvent as WorkflowEvent } from '../dto/workflow-event.dto';
import { InternalTransition } from '../transitions';

export class WorkflowUpdatedEvent {
  constructor(
    readonly reportId: ID,
    readonly previousStatus: Status,
    readonly next: InternalTransition | Status,
    readonly workflowEvent: UnsecuredDto<WorkflowEvent>,
  ) {}
}
