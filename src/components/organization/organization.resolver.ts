import {
  Args,
  ArgsType,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  firstLettersOfWords,
  type ID,
  IdArg,
  IdField,
  ListArg,
  loadSecuredIds,
  mapSecuredValue,
} from '~/common';
import { Loader, type LoaderOf } from '~/core';
import { AllianceMembershipLoader } from '../alliance-membership/alliance-membership.loader';
import { SecuredAllianceMemberships } from '../alliance-membership/dto';
import { LocationLoader } from '../location';
import { LocationListInput, SecuredLocationList } from '../location/dto';
import { OrganizationLoader, OrganizationService } from '../organization';
import {
  CreateOrganizationInput,
  CreateOrganizationOutput,
  DeleteOrganizationOutput,
  Organization,
  OrganizationListInput,
  OrganizationListOutput,
  SecuredOrganization,
  UpdateOrganizationInput,
  UpdateOrganizationOutput,
} from './dto';

@ArgsType()
class ModifyLocationArgs {
  @IdField()
  organizationId: ID;

  @IdField()
  locationId: ID;
}

@Resolver(Organization)
export class OrganizationResolver {
  constructor(private readonly orgs: OrganizationService) {}

  @Mutation(() => CreateOrganizationOutput, {
    description: 'Create an organization',
  })
  async createOrganization(
    @Args('input') { organization: input }: CreateOrganizationInput,
  ): Promise<CreateOrganizationOutput> {
    const organization = await this.orgs.create(input);
    return { organization };
  }

  @Query(() => Organization, {
    description: 'Look up an organization by its ID',
  })
  async organization(
    @Loader(OrganizationLoader) organizations: LoaderOf<OrganizationLoader>,
    @IdArg() id: ID,
  ): Promise<Organization> {
    return await organizations.load(id);
  }

  @ResolveField(() => String, { nullable: true })
  avatarLetters(@Parent() org: Organization): string | undefined {
    return org.name.canRead && org.name.value
      ? firstLettersOfWords(org.name.value)
      : undefined;
  }

  @Query(() => OrganizationListOutput, {
    description: 'Look up organizations',
  })
  async organizations(
    @ListArg(OrganizationListInput) input: OrganizationListInput,
    @Loader(OrganizationLoader) organizations: LoaderOf<OrganizationLoader>,
  ): Promise<OrganizationListOutput> {
    const list = await this.orgs.list(input);
    organizations.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredLocationList)
  async locations(
    @Parent() organization: Organization,
    @ListArg(LocationListInput) input: LocationListInput,
    @Loader(LocationLoader) locations: LoaderOf<LocationLoader>,
  ): Promise<SecuredLocationList> {
    const list = await this.orgs.listLocations(organization, input);
    locations.primeAll(list.items);
    return list;
  }

  @Mutation(() => UpdateOrganizationOutput, {
    description: 'Update an organization',
  })
  async updateOrganization(
    @Args('input') { organization: input }: UpdateOrganizationInput,
  ): Promise<UpdateOrganizationOutput> {
    const organization = await this.orgs.update(input);
    return { organization };
  }

  @Mutation(() => DeleteOrganizationOutput, {
    description: 'Delete an organization',
  })
  async deleteOrganization(@IdArg() id: ID): Promise<DeleteOrganizationOutput> {
    await this.orgs.delete(id);
    return { success: true };
  }

  @Mutation(() => Organization, {
    description: 'Add a location to a organization',
  })
  async addLocationToOrganization(
    @Args() { organizationId, locationId }: ModifyLocationArgs,
  ): Promise<Organization> {
    await this.orgs.addLocation(organizationId, locationId);
    return await this.orgs.readOne(organizationId);
  }

  @Mutation(() => Organization, {
    description: 'Remove a location from a organization',
  })
  async removeLocationFromOrganization(
    @Args() { organizationId, locationId }: ModifyLocationArgs,
  ): Promise<Organization> {
    await this.orgs.removeLocation(organizationId, locationId);
    return await this.orgs.readOne(organizationId);
  }

  @ResolveField(() => SecuredOrganization)
  async parent(
    @Parent() organization: Organization,
    @Loader(OrganizationLoader) organizations: LoaderOf<OrganizationLoader>,
  ): Promise<SecuredOrganization> {
    return await mapSecuredValue(organization.parent, ({ id }) =>
      organizations.load(id),
    );
  }

  @ResolveField(() => SecuredAllianceMemberships)
  async allianceMembers(
    @Parent() organization: Organization,
    @Loader(AllianceMembershipLoader)
    loader: LoaderOf<AllianceMembershipLoader>,
  ): Promise<SecuredAllianceMemberships> {
    return await loadSecuredIds(loader, {
      ...organization.allianceMembers,
      value: organization.allianceMembers.value.map(
        (membership) => membership.id,
      ),
    });
  }

  @ResolveField(() => SecuredAllianceMemberships)
  async joinedAlliances(
    @Parent() organization: Organization,
    @Loader(AllianceMembershipLoader)
    loader: LoaderOf<AllianceMembershipLoader>,
  ): Promise<SecuredAllianceMemberships> {
    return await loadSecuredIds(loader, {
      ...organization.joinedAlliances,
      value: organization.joinedAlliances.value.map(
        (membership) => membership.id,
      ),
    });
  }
}
