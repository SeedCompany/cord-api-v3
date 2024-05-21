import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { LoggedInSession, Session } from '~/common';
import { IProject, Project } from '../../dto';
import { ExecuteProjectTransitionInput } from '../dto';
import { ProjectWorkflowService } from '../project-workflow.service';

@Resolver()
export class ProjectExecuteTransitionResolver {
  constructor(private readonly workflow: ProjectWorkflowService) {}

  @Mutation(() => IProject)
  async transitionProject(
    @Args({ name: 'input' }) input: ExecuteProjectTransitionInput,
    @LoggedInSession() session: Session,
  ): Promise<Project> {
    return await this.workflow.executeTransition(input, session);
  }
}
