import { Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, LoaderOf } from '@seedcompany/data-loader';
import { stripIndent } from 'common-tags';
import {
  AnonSession,
  ParentIdMiddlewareAdditions,
  Session,
  viewOfChangeset,
} from '~/common';
import { SerializedWorkflow } from '../../../workflow/dto';
import { SecuredEngagementStatus } from '../../dto';
import { EngagementLoader } from '../../engagement.loader';
import { EngagementWorkflowTransition } from '../dto';
import { EngagementWorkflowService } from '../engagement-workflow.service';

@Resolver(SecuredEngagementStatus)
export class EngagementTransitionsResolver {
  constructor(private readonly workflow: EngagementWorkflowService) {}

  @Query(() => SerializedWorkflow)
  async engagementWorkflow() {
    return this.workflow.serialize();
  }

  @ResolveField(() => [EngagementWorkflowTransition], {
    description:
      'The transitions currently available to execute for this engagement',
  })
  async transitions(
    @Parent() status: SecuredEngagementStatus & ParentIdMiddlewareAdditions,
    @Loader(EngagementLoader) engagements: LoaderOf<EngagementLoader>,
    @AnonSession() session: Session,
  ): Promise<readonly EngagementWorkflowTransition[]> {
    if (!status.canRead || !status.value) {
      return [];
    }
    const engagement = await engagements.load({
      id: status.parentId,
      view: viewOfChangeset(status.changeset),
    });
    return await this.workflow.getAvailableTransitions(engagement, session);
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
