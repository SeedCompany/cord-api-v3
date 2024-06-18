import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { LoggedInSession, Session } from '~/common';
import { Engagement, IEngagement } from '../../dto';
import { ExecuteEngagementTransitionInput } from '../dto';
import { EngagementWorkflowService } from '../engagement-workflow.service';

@Resolver()
export class EngagementExecuteTransitionResolver {
  constructor(private readonly workflow: EngagementWorkflowService) {}

  @Mutation(() => IEngagement)
  async transitionEngagement(
    @Args({ name: 'input' }) input: ExecuteEngagementTransitionInput,
    @LoggedInSession() session: Session,
  ): Promise<Engagement> {
    return await this.workflow.executeTransition(input, session);
  }
}
