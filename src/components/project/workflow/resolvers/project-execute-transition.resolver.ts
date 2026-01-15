import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { IProject, type Project } from '../../dto';
import { ExecuteProjectTransition } from '../dto';
import { ProjectWorkflowService } from '../project-workflow.service';

@Resolver()
export class ProjectExecuteTransitionResolver {
  constructor(private readonly workflow: ProjectWorkflowService) {}

  @Mutation(() => IProject)
  async transitionProject(
    @Args('input') input: ExecuteProjectTransition,
  ): Promise<Project> {
    return await this.workflow.executeTransition(input);
  }
}
