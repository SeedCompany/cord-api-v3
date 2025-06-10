import { Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { Grandparent } from '~/common';
import { SerializedWorkflow } from '../../../workflow/dto';
import { type Project, SecuredProjectStep } from '../../dto';
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
    @Grandparent() project: Project,
    @Parent() status: SecuredProjectStep,
  ): Promise<readonly ProjectWorkflowTransition[]> {
    if (!status.canRead || !status.value) {
      return [];
    }
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
