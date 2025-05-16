import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { IProject, type Project } from '../../dto';
import { ExecuteProjectTransitionInput } from '../dto';
import { ProjectWorkflowService } from '../project-workflow.service';

@Resolver()
export class ProjectExecuteTransitionResolver {
  constructor(private readonly workflow: ProjectWorkflowService) {}

  @Mutation(() => IProject)
  async transitionProject(
    @Args({ name: 'input' }) input: ExecuteProjectTransitionInput,
  ): Promise<Project> {
    return await this.workflow.executeTransition(input);
  }
}
