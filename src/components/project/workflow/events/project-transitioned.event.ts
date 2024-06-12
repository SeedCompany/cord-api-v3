import type { UnsecuredDto } from '~/common';
import type { Project, ProjectStep } from '../../dto';
import type { ProjectWorkflowEvent as WorkflowEvent } from '../dto';
import { ProjectWorkflow } from '../project-workflow';

export class ProjectTransitionedEvent {
  constructor(
    readonly project: Project,
    readonly previousStep: ProjectStep,
    readonly next: (typeof ProjectWorkflow)['resolvedTransition'] | ProjectStep,
    readonly workflowEvent: UnsecuredDto<WorkflowEvent>,
  ) {}
}
