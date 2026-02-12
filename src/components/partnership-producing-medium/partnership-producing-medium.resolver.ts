import {
  Args,
  ArgsType,
  Field,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { type ID, IdField } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { PartnershipLoader } from '../partnership';
import { Partnership } from '../partnership/dto';
import {
  PartnershipProducingMedium,
  PartnershipProducingMediumUpdated,
  UpdatePartnershipProducingMedium,
} from './dto/partnership-producing-medium.dto';
import { PartnershipProducingMediumService } from './partnership-producing-medium.service';

@ArgsType()
class UpdatePartnershipProducingMediumsArgs {
  @IdField({ description: 'The engagement ID' })
  readonly engagement: ID<'LanguageEngagement'>;

  @Field(() => [UpdatePartnershipProducingMedium], {
    description:
      'A partial list of changes to the partners producing which mediums',
  })
  readonly input: readonly UpdatePartnershipProducingMedium[];
}

@Resolver(PartnershipProducingMedium)
export class PartnershipProducingMediumResolver {
  constructor(private readonly service: PartnershipProducingMediumService) {}

  @ResolveField(() => Partnership, {
    nullable: true,
  })
  async partnership(
    @Parent() pair: PartnershipProducingMedium,
    @Loader(() => PartnershipLoader) partnerships: LoaderOf<PartnershipLoader>,
  ): Promise<Partnership | null> {
    return pair.partnership
      ? await partnerships.load({
          id: pair.partnership,
          view: { active: true },
        })
      : null;
  }

  @Mutation(() => PartnershipProducingMediumUpdated)
  async updatePartnershipsProducingMediums(
    @Args() { engagement, input }: UpdatePartnershipProducingMediumsArgs,
  ): Promise<PartnershipProducingMediumUpdated> {
    await this.service.update(engagement, input);
    return { engagement };
  }
}
