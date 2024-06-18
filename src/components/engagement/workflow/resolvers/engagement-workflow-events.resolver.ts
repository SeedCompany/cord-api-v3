import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { AnonSession, Session } from '~/common';
import { Engagement, IEngagement } from '../../dto';
import { EngagementWorkflowEvent as WorkflowEvent } from '../dto';
import { EngagementWorkflowService } from '../engagement-workflow.service';

@Resolver(IEngagement)
export class EngagementWorkflowEventsResolver {
  constructor(private readonly service: EngagementWorkflowService) {}

  @ResolveField(() => [WorkflowEvent])
  async workflowEvents(
    @Parent() engagement: Engagement,
    @AnonSession() session: Session,
  ): Promise<readonly WorkflowEvent[]> {
    return await this.service.list(engagement, session);
  }
}
