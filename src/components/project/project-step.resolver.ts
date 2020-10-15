import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ISession, ServerException, Session } from '../../common';
import { ProjectStepTransition, SecuredProjectStep } from './dto';
import { ProjectRules } from './project.rules';

@Resolver(SecuredProjectStep)
export class ProjectStepResolver {
  constructor(private readonly projectRules: ProjectRules) {}

  @ResolveField(() => [ProjectStepTransition], {
    description: 'The available steps a project can be transitioned to.',
  })
  async transitions(
    @Parent() step: SecuredProjectStep & { projectId?: string },
    @Session() session: ISession
  ): Promise<ProjectStepTransition[]> {
    if (!step.projectId) {
      throw new ServerException(
        'Project ID should have been provided by Project resolver'
      );
    }
    if (!step.canRead || !step.value) {
      return [];
    }
    return await this.projectRules.getAvailableTransitions(
      step.projectId,
      session.userId
    );
  }
}
