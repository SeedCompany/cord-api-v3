import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { AnonSession, ID, IdArg, Session } from '../../common';
import { ProjectStepTransition, SecuredProjectStep } from './dto';
import { ProjectRules } from './project.rules';

@Resolver(SecuredProjectStep)
export class ProjectStepResolver {
  constructor(private readonly projectRules: ProjectRules) {}

  @ResolveField(() => [ProjectStepTransition], {
    description: 'The available steps a project can be transitioned to.',
  })
  async transitions(
    @Parent() step: SecuredProjectStep & { parentId: ID },
    @AnonSession() session: Session,
    @IdArg({ nullable: true }) id?: ID
  ): Promise<ProjectStepTransition[]> {
    if (!step.canRead || !step.canEdit || !step.value) {
      return [];
    }
    return await this.projectRules.getAvailableTransitions(
      step.parentId,
      session,
      undefined,
      id
    );
  }

  @ResolveField(() => Boolean, {
    description: stripIndent`
      Is the current user allowed to bypass transitions entirely
      and change the step to any other step?
   `,
  })
  async canBypassTransitions(
    @AnonSession() session: Session
  ): Promise<boolean> {
    return await this.projectRules.canBypassWorkflow(session);
  }
}
