import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { type ID, IdArg, mapSecuredValue } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { OrganizationLoader } from '../organization';
import {
  CreateOtherPartnerContribution,
  OtherPartnerContribution,
  OtherPartnerContributionCreated,
  OtherPartnerContributionDeleted,
  OtherPartnerContributionUpdated,
  SecuredOrganizationNullable,
  UpdateOtherPartnerContribution,
} from './dto';
import { OtherPartnerContributionService } from './other-partner-contribution.service';

@Resolver(OtherPartnerContribution)
export class OtherPartnerContributionResolver {
  constructor(private readonly service: OtherPartnerContributionService) {}

  @ResolveField(() => SecuredOrganizationNullable, {
    description: 'The partner organization making this contribution.',
  })
  async donor(
    @Parent() opc: OtherPartnerContribution,
    @Loader(OrganizationLoader) organizations: LoaderOf<OrganizationLoader>,
  ): Promise<SecuredOrganizationNullable> {
    return await mapSecuredValue(opc.donor, (id) => organizations.load(id));
  }

  @Mutation(() => OtherPartnerContributionCreated, {
    description: 'Create an other-partner contribution',
  })
  async createOtherPartnerContribution(
    @Args('input') input: CreateOtherPartnerContribution,
  ): Promise<OtherPartnerContributionCreated> {
    const otherPartnerContribution = await this.service.create(input);
    return { otherPartnerContribution };
  }

  @Mutation(() => OtherPartnerContributionUpdated, {
    description: 'Update an other-partner contribution',
  })
  async updateOtherPartnerContribution(
    @Args('input') input: UpdateOtherPartnerContribution,
  ): Promise<OtherPartnerContributionUpdated> {
    const otherPartnerContribution = await this.service.update(input);
    return { otherPartnerContribution };
  }

  @Mutation(() => OtherPartnerContributionDeleted, {
    description: 'Delete an other-partner contribution',
  })
  async deleteOtherPartnerContribution(
    @IdArg() id: ID,
  ): Promise<OtherPartnerContributionDeleted> {
    await this.service.delete(id);
    return {};
  }
}
