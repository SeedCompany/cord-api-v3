import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { Grandparent } from '~/common';
import {
  type Engagement,
  EngagementStatusTransition,
  SecuredEngagementStatus,
} from './dto';
import { EngagementRules } from './engagement.rules';

@Resolver(SecuredEngagementStatus)
export class EngagementStatusResolver {
  constructor(private readonly engagementRules: EngagementRules) {}

  @ResolveField(() => [EngagementStatusTransition], {
    description: 'The available statuses a engagement can be transitioned to.',
  })
  async transitions(
    @Grandparent() eng: Engagement,
    @Parent() status: SecuredEngagementStatus,
  ): Promise<EngagementStatusTransition[]> {
    if (!status.canRead || !status.canEdit || !status.value) {
      return [];
    }
    return await this.engagementRules.getAvailableTransitions(
      eng.id,
      eng.changeset,
    );
  }

  @ResolveField(() => Boolean, {
    description: stripIndent`
      Is the current user allowed to bypass transitions entirely
      and change the status to any other status?
   `,
  })
  canBypassTransitions(): boolean {
    return this.engagementRules.canBypassWorkflow();
  }
}
