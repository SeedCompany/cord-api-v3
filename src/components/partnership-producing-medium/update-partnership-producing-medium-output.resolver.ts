import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, LoaderOf } from '~/core';
import { EngagementLoader } from '../engagement';
import { Engagement, LanguageEngagement } from '../engagement/dto';
import { UpdatePartnershipProducingMediumOutput } from './dto/partnership-producing-medium.dto';

@Resolver(UpdatePartnershipProducingMediumOutput)
export class UpdatePartnershipProducingMediumOutputResolver {
  @ResolveField(() => LanguageEngagement)
  engagement(
    @Parent() output: UpdatePartnershipProducingMediumOutput,
    @Loader(() => EngagementLoader) engagements: LoaderOf<EngagementLoader>,
  ): Promise<Engagement> {
    return engagements.load({ id: output.engagement, view: { active: true } });
  }
}
