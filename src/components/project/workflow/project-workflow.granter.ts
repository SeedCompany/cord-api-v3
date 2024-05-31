import { Granter } from '../../authorization';
import { WorkflowEventGranter } from '../../workflow/workflow.granter';
import { ProjectStep } from '../dto';
import { ProjectWorkflowEvent as Event } from './dto';
import { Transitions } from './transitions';

@Granter(Event)
export class ProjectWorkflowEventGranter extends WorkflowEventGranter(
  ProjectStep,
  Transitions,
  Event,
) {}

declare module '../../authorization/policy/granters' {
  interface GrantersOverride {
    ProjectWorkflowEvent: ProjectWorkflowEventGranter;
  }
}
