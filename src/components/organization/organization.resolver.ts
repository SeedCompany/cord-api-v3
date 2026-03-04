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
} from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { LocationLoader } from '../location';
import { LocationListInput, SecuredLocationList } from '../location/dto';
import { OrganizationLoader, OrganizationService } from '../organization';
import {
  CreateOrganization,
  Organization,
  OrganizationCreated,
  OrganizationDeleted,
  OrganizationListInput,
  OrganizationListOutput,
  OrganizationUpdated,
  UpdateOrganization,
} from './dto';

@ArgsType()
class ModifyLocationArgs {
  @IdField()
  organization: ID<'Organization'>;

  @IdField()
  location: ID<'Location'>;
}

@Resolver(Organization)
export class OrganizationResolver {
  constructor(private readonly orgs: OrganizationService) {}

  @Mutation(() => OrganizationCreated, {
    description: 'Create an organization',
  })
  async createOrganization(
    @Args('input') input: CreateOrganization,
  ): Promise<OrganizationCreated> {
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

  @Mutation(() => OrganizationUpdated, {
    description: 'Update an organization',
  })
  async updateOrganization(
    @Args('input') input: UpdateOrganization,
  ): Promise<OrganizationUpdated> {
    const organization = await this.orgs.update(input);
    return { organization };
  }

  @Mutation(() => OrganizationDeleted, {
    description: 'Delete an organization',
  })
  async deleteOrganization(@IdArg() id: ID): Promise<OrganizationDeleted> {
    await this.orgs.delete(id);
    return {};
  }

  @Mutation(() => Organization, {
    description: 'Add a location to a organization',
  })
  async addLocationToOrganization(
    @Args() { organization, location }: ModifyLocationArgs,
  ): Promise<Organization> {
    await this.orgs.addLocation(organization, location);
    return await this.orgs.readOne(organization);
  }

  @Mutation(() => Organization, {
    description: 'Remove a location from a organization',
  })
  async removeLocationFromOrganization(
    @Args() { organization, location }: ModifyLocationArgs,
  ): Promise<Organization> {
    await this.orgs.removeLocation(organization, location);
    return await this.orgs.readOne(organization);
  }
}
