import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { AnonSession, Session } from '../../common';
import { EngagementStatusTransition, SecuredEngagementStatus } from './dto';
import { EngagementRules } from './engagement.rules';

@Resolver(SecuredEngagementStatus)
export class EngagementStatusResolver {
  constructor(private readonly engagementRules: EngagementRules) {}

  @ResolveField(() => [EngagementStatusTransition], {
    description: 'The available statuses a engagement can be transitioned to.',
  })
  async transitions(
    @Parent() status: SecuredEngagementStatus & { engagementId?: string },
    @AnonSession() session: Session
  ): Promise<EngagementStatusTransition[]> {
    if (!status.canRead || !status.value || !status.engagementId) {
      return [];
    }
    return await this.engagementRules.getAvailableTransitions(
      status.engagementId,
      session
    );
  }
}
