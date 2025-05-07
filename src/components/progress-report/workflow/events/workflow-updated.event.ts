import { type ID, type Session, type UnsecuredDto } from '~/common';
import { type ProgressReportStatus as Status } from '../../dto';
import { type ProgressReportWorkflowEvent as WorkflowEvent } from '../dto/workflow-event.dto';
import { type InternalTransition } from '../transitions';

export class WorkflowUpdatedEvent {
  constructor(
    readonly reportId: ID,
    readonly previousStatus: Status,
    readonly next: InternalTransition | Status,
    readonly workflowEvent: UnsecuredDto<WorkflowEvent>,
    readonly session: Session,
  ) {}
}
