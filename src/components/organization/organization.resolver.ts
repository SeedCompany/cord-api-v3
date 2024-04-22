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
  AnonSession,
  firstLettersOfWords,
  ID,
  IdArg,
  IdField,
  ListArg,
  LoggedInSession,
  Session,
} from '../../common';
import { Loader, LoaderOf } from '../../core';
import {
  LocationListInput,
  LocationLoader,
  SecuredLocationList,
} from '../location';
import { OrganizationLoader, OrganizationService } from '../organization';
import {
  CreateOrganizationInput,
  CreateOrganizationOutput,
  DeleteOrganizationOutput,
  Organization,
  OrganizationListInput,
  OrganizationListOutput,
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
    @LoggedInSession() session: Session,
    @Args('input') { organization: input }: CreateOrganizationInput,
  ): Promise<CreateOrganizationOutput> {
    const organization = await this.orgs.create(input, session);
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
    @AnonSession() session: Session,
    @ListArg(OrganizationListInput) input: OrganizationListInput,
    @Loader(OrganizationLoader) organizations: LoaderOf<OrganizationLoader>,
  ): Promise<OrganizationListOutput> {
    const list = await this.orgs.list(input, session);
    organizations.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredLocationList)
  async locations(
    @AnonSession() session: Session,
    @Parent() organization: Organization,
    @ListArg(LocationListInput) input: LocationListInput,
    @Loader(LocationLoader) locations: LoaderOf<LocationLoader>,
  ): Promise<SecuredLocationList> {
    const list = await this.orgs.listLocations(organization, input, session);
    locations.primeAll(list.items);
    return list;
  }

  @Mutation(() => UpdateOrganizationOutput, {
    description: 'Update an organization',
  })
  async updateOrganization(
    @LoggedInSession() session: Session,
    @Args('input') { organization: input }: UpdateOrganizationInput,
  ): Promise<UpdateOrganizationOutput> {
    const organization = await this.orgs.update(input, session);
    return { organization };
  }

  @Mutation(() => DeleteOrganizationOutput, {
    description: 'Delete an organization',
  })
  async deleteOrganization(
    @LoggedInSession() session: Session,
    @IdArg() id: ID,
  ): Promise<DeleteOrganizationOutput> {
    await this.orgs.delete(id, session);
    return { success: true };
  }

  @Mutation(() => Organization, {
    description: 'Add a location to a organization',
  })
  async addLocationToOrganization(
    @LoggedInSession() session: Session,
    @Args() { organizationId, locationId }: ModifyLocationArgs,
  ): Promise<Organization> {
    await this.orgs.addLocation(organizationId, locationId);
    return await this.orgs.readOne(organizationId, session);
  }

  @Mutation(() => Organization, {
    description: 'Remove a location from a organization',
  })
  async removeLocationFromOrganization(
    @LoggedInSession() session: Session,
    @Args() { organizationId, locationId }: ModifyLocationArgs,
  ): Promise<Organization> {
    await this.orgs.removeLocation(organizationId, locationId);
    return await this.orgs.readOne(organizationId, session);
  }
}
