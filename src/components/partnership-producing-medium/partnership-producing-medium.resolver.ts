import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { ID, IdArg, LoggedInSession, Session } from '../../common';
import { Loader, LoaderOf } from '../../core';
import { Partnership, PartnershipLoader } from '../partnership';
import {
  PartnershipProducingMedium,
  PartnershipProducingMediumInput,
  UpdatePartnershipProducingMediumOutput,
} from './dto/partnership-producing-medium.dto';
import { PartnershipProducingMediumService } from './partnership-producing-medium.service';

@Resolver(PartnershipProducingMedium)
export class PartnershipProducingMediumResolver {
  constructor(private readonly service: PartnershipProducingMediumService) {}

  @ResolveField(() => Partnership, {
    nullable: true,
  })
  async partnership(
    @Parent() pair: PartnershipProducingMedium,
    @Loader(() => PartnershipLoader) partnerships: LoaderOf<PartnershipLoader>
  ): Promise<Partnership | null> {
    return pair.partnership
      ? await partnerships.load({
          id: pair.partnership,
          view: { active: true },
        })
      : null;
  }

  @Mutation(() => UpdatePartnershipProducingMediumOutput)
  async updatePartnershipsProducingMediums(
    @IdArg({ name: 'engagementId', description: 'A LanguageEngagement ID' })
    engagementId: ID,
    @Args({
      name: 'input',
      type: () => [PartnershipProducingMediumInput],
      description:
        'A partial list of changes to the partners producing which mediums',
    })
    input: readonly PartnershipProducingMediumInput[],
    @LoggedInSession() session: Session
  ): Promise<UpdatePartnershipProducingMediumOutput> {
    await this.service.update(engagementId, input, session);
    return { engagement: engagementId };
  }
}
