import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { AnonSession, Session } from '~/common';
import { LanguageEngagement } from '../engagement/dto';
import { SecuredPartnershipsProducingMediums } from './dto/partnership-producing-medium.dto';
import { PartnershipProducingMediumService } from './partnership-producing-medium.service';

@Resolver(LanguageEngagement)
export class PartnershipProducingMediumEngagementConnectionResolver {
  constructor(private readonly service: PartnershipProducingMediumService) {}

  @ResolveField(() => SecuredPartnershipsProducingMediums, {
    description: stripIndent`
      A list of mediums used across all of the engagement's products and their
      associated partnerships which are "producing" each medium.
    `,
  })
  async partnershipsProducingMediums(
    @Parent() engagement: LanguageEngagement,
    @AnonSession() session: Session,
  ): Promise<SecuredPartnershipsProducingMediums> {
    return await this.service.list(engagement, session);
  }
}
