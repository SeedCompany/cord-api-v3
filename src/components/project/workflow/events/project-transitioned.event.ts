import type { UnsecuredDto } from '~/common';
import type { Project, ProjectStep } from '../../dto';
import type { ProjectWorkflowEvent as WorkflowEvent } from '../dto';
import type { InternalTransition } from '../transitions';

export class ProjectTransitionedEvent {
  constructor(
    readonly project: Project,
    readonly previousStep: ProjectStep,
    readonly next: InternalTransition | ProjectStep,
    readonly workflowEvent: UnsecuredDto<WorkflowEvent>,
  ) {}
}
