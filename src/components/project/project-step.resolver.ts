import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, LoaderOf } from '@seedcompany/data-loader';
import { AnonSession, ID, Session, viewOfChangeset } from '~/common';
import { ProjectStepTransition, SecuredProjectStep } from './dto';
import { ProjectLoader } from './project.loader';
import { ProjectRules } from './project.rules';

@Resolver(SecuredProjectStep)
export class ProjectStepResolver {
  constructor(private readonly projectRules: ProjectRules) {}

  @ResolveField(() => [ProjectStepTransition], {
    description: 'The available steps a project can be transitioned to.',
    deprecationReason: 'Use `transitions2` instead.',
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
}
