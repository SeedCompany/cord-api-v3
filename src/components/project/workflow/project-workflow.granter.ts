import { Granter } from '../../authorization';
import { WorkflowEventGranter } from '../../workflow/workflow.granter';
import { ProjectWorkflowEvent as Event } from './dto';
import { ProjectWorkflow } from './project-workflow';

@Granter(Event)
export class ProjectWorkflowEventGranter extends WorkflowEventGranter(
  () => ProjectWorkflow,
) {}

declare module '../../authorization/policy/granters' {
  interface GrantersOverride {
    ProjectWorkflowEvent: ProjectWorkflowEventGranter;
  }
}
