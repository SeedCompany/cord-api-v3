import type { Session, UnsecuredDto } from '~/common';
import type { Project, ProjectStep } from '../../dto';
import type { ProjectWorkflowEvent as WorkflowEvent } from '../dto';
import type { ProjectWorkflow } from '../project-workflow';

export class ProjectTransitionedEvent {
  constructor(
    public project: UnsecuredDto<Project>,
    readonly previousStep: ProjectStep,
    readonly next: (typeof ProjectWorkflow)['resolvedTransition'] | ProjectStep,
    readonly workflowEvent: UnsecuredDto<WorkflowEvent>,
    readonly session: Session,
  ) {}
}
