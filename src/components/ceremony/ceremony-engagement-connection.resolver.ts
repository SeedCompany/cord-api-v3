import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { EngagementLoader } from '../engagement';
import { type Engagement, IEngagement } from '../engagement/dto';
import { Ceremony } from './dto';

@Resolver(Ceremony)
export class CeremonyEngagementConnectionResolver {
  @ResolveField(() => IEngagement, {
    description: 'The engagement this ceremony belongs to',
  })
  async engagement(
    @Parent() ceremony: Ceremony,
    @Loader(EngagementLoader) engagements: LoaderOf<EngagementLoader>,
  ): Promise<Engagement> {
    return await engagements.load({
      id: ceremony.engagement.id,
      view: { active: true },
    });
  }
}
