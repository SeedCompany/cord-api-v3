import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { ExecuteProjectTransition, ProjectTransitioned } from '../dto';
import { ProjectWorkflowService } from '../project-workflow.service';

@Resolver()
export class ProjectExecuteTransitionResolver {
  constructor(private readonly workflow: ProjectWorkflowService) {}

  @Mutation(() => ProjectTransitioned)
  async transitionProject(
    @Args('input') input: ExecuteProjectTransition,
  ): Promise<ProjectTransitioned> {
    const { event, project, ...rest } =
      await this.workflow.executeTransition(input);
    return {
      __typename: 'ProjectTransitioned',
      projectId: project,
      event: this.workflow.secure(event),
      ...rest,
    };
  }
}
