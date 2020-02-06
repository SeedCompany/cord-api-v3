import { Resolver, Args, Query, Mutation } from '@nestjs/graphql';
import { IdArg } from '../../common';
import { ISession, Session } from '../auth/session'; // avoid cyclic dep (auth -> user -> org)
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

@Resolver(Organization.name)
export class OrganizationResolver {
  constructor(private readonly orgs: OrganizationService) {}

  @Mutation(() => CreateOrganizationOutput, {
    description: 'Create an organization',
  })
  async createOrganization(
    @Session() session: ISession,
    @Args('input') { organization: input }: CreateOrganizationInput,
  ): Promise<CreateOrganizationOutput> {
    const organization = await this.orgs.create(input, session);
    return { organization };
  }

  @Query(() => Organization, {
    description: 'Look up an organization by its ID',
  })
  async organization(
    @Session() session: ISession,
    @IdArg() id: string,
  ): Promise<Organization> {
    return this.orgs.readOne(id, session);
  }

  @Query(() => OrganizationListOutput, {
    description: 'Look up organizations',
  })
  async organizations(
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => OrganizationListInput,
      defaultValue: OrganizationListInput.defaultVal,
    })
    input: OrganizationListInput,
  ): Promise<OrganizationListOutput> {
    return this.orgs.list(input, session);
  }

  @Mutation(() => UpdateOrganizationOutput, {
    description: 'Update an organization',
  })
  async updateOrganization(
    @Session() session: ISession,
    @Args('input') { organization: input }: UpdateOrganizationInput,
  ): Promise<UpdateOrganizationOutput> {
    const organization = await this.orgs.update(input, session);
    return { organization };
  }

  @Mutation(() => Boolean, {
    description: 'Delete an organization',
  })
  async deleteOrganization(
    @Session() session: ISession,
    @IdArg() id: string,
  ): Promise<boolean> {
    await this.orgs.delete(id, session);
    return true;
  }
}
