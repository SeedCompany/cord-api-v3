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
  LoggedInSession,
  Session,
} from '../../common';
import { LocationListInput, SecuredLocationList } from '../location';
import {
  CreateOrganizationInput,
  CreateOrganizationOutput,
  Organization,
  OrganizationListInput,
  OrganizationListOutput,
  UpdateOrganizationInput,
  UpdateOrganizationOutput,
} from './dto';
import { OrganizationService } from './organization.service';

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
    @Args('input') { organization: input }: CreateOrganizationInput
  ): Promise<CreateOrganizationOutput> {
    const organization = await this.orgs.create(input, session);
    return { organization };
  }

  @Query(() => Organization, {
    description: 'Look up an organization by its ID',
  })
  async organization(
    @AnonSession() session: Session,
    @IdArg() id: ID
  ): Promise<Organization> {
    return await this.orgs.readOne(id, session);
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
    @Args({
      name: 'input',
      type: () => OrganizationListInput,
      defaultValue: OrganizationListInput.defaultVal,
    })
    input: OrganizationListInput
  ): Promise<OrganizationListOutput> {
    return await this.orgs.list(input, session);
  }

  @ResolveField(() => SecuredLocationList)
  async locations(
    @AnonSession() session: Session,
    @Parent() organization: Organization,
    @Args({
      name: 'input',
      type: () => LocationListInput,
      defaultValue: LocationListInput.defaultVal,
    })
    input: LocationListInput
  ): Promise<SecuredLocationList> {
    return await this.orgs.listLocations(organization, input, session);
  }

  @Mutation(() => UpdateOrganizationOutput, {
    description: 'Update an organization',
  })
  async updateOrganization(
    @LoggedInSession() session: Session,
    @Args('input') { organization: input }: UpdateOrganizationInput
  ): Promise<UpdateOrganizationOutput> {
    const organization = await this.orgs.update(input, session);
    return { organization };
  }

  @Mutation(() => Boolean, {
    description: 'Delete an organization',
  })
  async deleteOrganization(
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<boolean> {
    await this.orgs.delete(id, session);
    return true;
  }

  @Mutation(() => Organization, {
    description: 'Add a location to a organization',
  })
  async addLocationToOrganization(
    @LoggedInSession() session: Session,
    @Args() { organizationId, locationId }: ModifyLocationArgs
  ): Promise<Organization> {
    await this.orgs.addLocation(organizationId, locationId, session);
    return await this.orgs.readOne(organizationId, session);
  }

  @Mutation(() => Organization, {
    description: 'Remove a location from a organization',
  })
  async removeLocationFromOrganization(
    @LoggedInSession() session: Session,
    @Args() { organizationId, locationId }: ModifyLocationArgs
  ): Promise<Organization> {
    await this.orgs.removeLocation(organizationId, locationId, session);
    return await this.orgs.readOne(organizationId, session);
  }
}
