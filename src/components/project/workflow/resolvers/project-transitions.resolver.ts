import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, LoaderOf } from '@seedcompany/data-loader';
import { stripIndent } from 'common-tags';
import {
  AnonSession,
  ParentIdMiddlewareAdditions,
  Session,
  viewOfChangeset,
} from '~/common';
import { SecuredProjectStep } from '../../dto';
import { ProjectLoader } from '../../project.loader';
import { ProjectWorkflowTransition } from '../dto';
import { ProjectWorkflowService } from '../project-workflow.service';

@Resolver(SecuredProjectStep)
export class ProjectTransitionsResolver {
  constructor(private readonly workflow: ProjectWorkflowService) {}

  @ResolveField(() => [ProjectWorkflowTransition], {
    description:
      'The transitions currently available to execute for this project',
  })
  async transitions(
    @Parent() status: SecuredProjectStep & ParentIdMiddlewareAdditions,
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
    @AnonSession() session: Session,
  ): Promise<readonly ProjectWorkflowTransition[]> {
    if (!status.canRead || !status.value) {
      return [];
    }
    const project = await projects.load({
      id: status.parentId,
      view: viewOfChangeset(status.changeset),
    });
    return await this.workflow.getAvailableTransitions(project, session);
  }

  @ResolveField(() => Boolean, {
    description: stripIndent`
      Is the current user allowed to bypass transitions entirely
      and change to any other state?
   `,
  })
  async canBypassTransitions(
    @AnonSession() session: Session,
  ): Promise<boolean> {
    return this.workflow.canBypass(session);
  }
}
