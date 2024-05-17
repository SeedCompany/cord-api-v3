import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, LoaderOf } from '@seedcompany/data-loader';
import { stripIndent } from 'common-tags';
import { AnonSession, ID, Session, viewOfChangeset } from '~/common';
import { ProjectStepTransition, SecuredProjectStep } from './dto';
import { ProjectRules } from './project-rules/project.rules';
import { ProjectLoader } from './project.loader';

@Resolver(SecuredProjectStep)
export class ProjectStepResolver {
  constructor(private readonly projectRules: ProjectRules) {}

  @ResolveField(() => [ProjectStepTransition], {
    description: 'The available steps a project can be transitioned to.',
  })
  async transitions(
    @Parent() step: SecuredProjectStep & { parentId: ID; changeset?: ID },
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
    @AnonSession() session: Session,
  ): Promise<ProjectStepTransition[]> {
    if (!step.canRead || !step.canEdit || !step.value) {
      return [];
    }
    const project = await projects.load({
      id: step.parentId,
      view: viewOfChangeset(step.changeset),
    });
    return await this.projectRules.getAvailableTransitions(
      step.parentId,
      session,
      project.type,
      undefined,
      step.changeset,
    );
  }

  @ResolveField(() => Boolean, {
    description: stripIndent`
      Is the current user allowed to bypass transitions entirely
      and change the step to any other step?
   `,
  })
  async canBypassTransitions(
    @AnonSession() session: Session,
  ): Promise<boolean> {
    return await this.projectRules.canBypassWorkflow(session);
  }
}
