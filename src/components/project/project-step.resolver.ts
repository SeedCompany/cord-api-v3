import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { AnonSession, ID, Session } from '../../common';
import {
  ProjectStepChange,
  ProjectStepTransition,
  SecuredProjectStep,
} from './dto';
import { ProjectRules } from './project.rules';
import { ProjectService } from './project.service';

@Resolver(SecuredProjectStep)
export class ProjectStepResolver {
  constructor(
    private readonly projectRules: ProjectRules,
    private readonly projectService: ProjectService
  ) {}

  @ResolveField(() => [ProjectStepTransition], {
    description: 'The available steps a project can be transitioned to.',
  })
  async transitions(
    @Parent() step: SecuredProjectStep & { parentId: ID; changeset?: ID },
    @AnonSession() session: Session
  ): Promise<ProjectStepTransition[]> {
    if (!step.canRead || !step.canEdit || !step.value) {
      return [];
    }
    return await this.projectRules.getAvailableTransitions(
      step.parentId,
      session,
      undefined,
      step.changeset
    );
  }

  @ResolveField(() => [ProjectStepChange], {
    description: 'The history of project steps.',
  })
  async history(
    @Parent() step: SecuredProjectStep & { parentId: ID; changeset?: ID },
    @AnonSession() _session: Session
  ): Promise<readonly ProjectStepChange[]> {
    if (!step.canRead || !step.value) {
      return [];
    }
    return await this.projectService.listStepChangeHistory(
      step.parentId,
      step.changeset
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
