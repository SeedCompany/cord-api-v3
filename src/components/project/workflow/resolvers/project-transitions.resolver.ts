import { Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, type LoaderOf } from '@seedcompany/data-loader';
import { stripIndent } from 'common-tags';
import { type ParentIdMiddlewareAdditions, viewOfChangeset } from '~/common';
import { SerializedWorkflow } from '../../../workflow/dto';
import { SecuredProjectStep } from '../../dto';
import { ProjectLoader } from '../../project.loader';
import { ProjectWorkflowTransition } from '../dto';
import { ProjectWorkflowService } from '../project-workflow.service';

@Resolver(SecuredProjectStep)
export class ProjectTransitionsResolver {
  constructor(private readonly workflow: ProjectWorkflowService) {}

  @Query(() => SerializedWorkflow)
  async projectWorkflow() {
    return this.workflow.serialize();
  }

  @ResolveField(() => [ProjectWorkflowTransition], {
    description:
      'The transitions currently available to execute for this project',
  })
  async transitions(
    @Parent() status: SecuredProjectStep & ParentIdMiddlewareAdditions,
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
  ): Promise<readonly ProjectWorkflowTransition[]> {
    if (!status.canRead || !status.value) {
      return [];
    }
    const project = await projects.load({
      id: status.parentId,
      view: viewOfChangeset(status.changeset),
    });
    return await this.workflow.getAvailableTransitions(project);
  }

  @ResolveField(() => Boolean, {
    description: stripIndent`
      Is the current user allowed to bypass transitions entirely
      and change to any other state?
   `,
  })
  async canBypassTransitions(): Promise<boolean> {
    return this.workflow.canBypass();
  }
}
