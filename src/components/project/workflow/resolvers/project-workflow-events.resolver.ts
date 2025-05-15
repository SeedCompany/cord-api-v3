import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { IProject, type Project } from '../../dto';
import { ProjectWorkflowEvent as WorkflowEvent } from '../dto';
import { ProjectWorkflowService } from '../project-workflow.service';

@Resolver(IProject)
export class ProjectWorkflowEventsResolver {
  constructor(private readonly service: ProjectWorkflowService) {}

  @ResolveField(() => [WorkflowEvent])
  async workflowEvents(
    @Parent() report: Project,
  ): Promise<readonly WorkflowEvent[]> {
    return await this.service.list(report);
  }
}
