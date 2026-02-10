import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, type LoaderOf } from '@seedcompany/data-loader';
import { type Engagement, EngagementMutation, IEngagement } from './dto';
import { EngagementLoader } from './engagement.loader';

@Resolver(EngagementMutation)
export class EngagementMutationLinksResolver {
  @ResolveField(() => IEngagement)
  async engagement(
    @Parent() change: EngagementMutation,
    @Loader(EngagementLoader) engagements: LoaderOf<EngagementLoader>,
  ): Promise<Engagement> {
    return await engagements.load({
      id: change.engagementId,
      view: { active: true },
    });
  }
}
