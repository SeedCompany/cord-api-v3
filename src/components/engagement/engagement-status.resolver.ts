import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { AnonSession, ID, Session } from '../../common';
import { EngagementStatusTransition, SecuredEngagementStatus } from './dto';
import { EngagementRules } from './engagement.rules';

@Resolver(SecuredEngagementStatus)
export class EngagementStatusResolver {
  constructor(private readonly engagementRules: EngagementRules) {}

  @ResolveField(() => [EngagementStatusTransition], {
    description: 'The available statuses a engagement can be transitioned to.',
  })
  async transitions(
    @Parent()
    status: SecuredEngagementStatus & { parentId: ID; changeset?: ID },
    @AnonSession() session: Session
  ): Promise<EngagementStatusTransition[]> {
    if (!status.canRead || !status.value) {
      return [];
    }
    return await this.engagementRules.getAvailableTransitions(
      status.parentId,
      session,
      undefined,
      status.changeset
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
