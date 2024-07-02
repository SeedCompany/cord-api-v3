import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { AnonSession, ParentIdMiddlewareAdditions, Session } from '~/common';
import { Loader, LoaderOf, ResourceLoader } from '~/core';
import { EngagementStatusTransition, SecuredEngagementStatus } from './dto';
import { EngagementLoader } from './engagement.loader';
import { EngagementWorkflowService } from './workflow/engagement-workflow.service';

@Resolver(SecuredEngagementStatus)
export class EngagementStatusResolver {
  constructor(
    private readonly resources: ResourceLoader,
    private readonly engagementWorkflowService: EngagementWorkflowService,
  ) {}

  @ResolveField(() => [EngagementStatusTransition], {
    description: 'The available statuses a engagement can be transitioned to.',
  })
  async transitions(
    @Parent()
    status: SecuredEngagementStatus & ParentIdMiddlewareAdditions,
    @Loader(EngagementLoader) engagements: LoaderOf<EngagementLoader>,
    @AnonSession() session: Session,
  ): Promise<EngagementStatusTransition[]> {
    if (!status.canRead || !status.canEdit || !status.value) {
      return [];
    }
    const loaderKey = {
      id: status.parentId,
      view: { active: true },
    } as const;
    const engagement = await engagements.load(loaderKey);
    return await this.engagementWorkflowService.getAvailableTransitions(
      engagement,
      session,
    );
  }

  @ResolveField(() => Boolean, {
    description: stripIndent`
      Is the current user allowed to bypass transitions entirely
      and change the status to any other status?
   `,
  })
  async canBypassTransitions(
    @AnonSession() session: Session,
  ): Promise<boolean> {
    return await this.engagementWorkflowService.canBypassWorkflow(session);
  }
}
