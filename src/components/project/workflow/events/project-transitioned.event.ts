import { ValueOf } from 'type-fest';
import type { UnsecuredDto } from '~/common';
import type { Project, ProjectStep } from '../../dto';
import type { ProjectWorkflowEvent as WorkflowEvent } from '../dto';
import { Transitions } from '../transitions';

export class ProjectTransitionedEvent {
  constructor(
    readonly project: Project,
    readonly previousStep: ProjectStep,
    readonly next: ValueOf<typeof Transitions> | ProjectStep,
    readonly workflowEvent: UnsecuredDto<WorkflowEvent>,
  ) {}
}
