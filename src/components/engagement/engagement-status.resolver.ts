import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { AnonSession, ServerException, Session } from '../../common';
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
    if (!status.engagementId) {
      throw new ServerException(
        'Engagement ID should have been provided by Engagement resolver'
      );
    }
    if (!status.canRead || !status.value) {
      return [];
    }
    return await this.engagementRules.getAvailableTransitions(
      status.engagementId,
      session
    );
  }

  @ResolveField(() => Boolean, {
    description: stripIndent`
      Is the current user allowed to bypass transitions entirely
      and change the status to any other status?
   `,
  })
  async canBypassTransitions(
    @AnonSession() session: Session
  ): Promise<boolean> {
    return await this.engagementRules.canBypassWorkflow(session);
  }
}
