import { Resolver, Args, Query, Mutation } from '@nestjs/graphql';
import { IdArg, RequestUser, IRequestUser } from '../../common';
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
    @RequestUser() token: IRequestUser,
    @Args('input') { organization: input }: CreateOrganizationInput,
  ): Promise<CreateOrganizationOutput> {
    const organization = await this.orgs.create(input, token);
    return { organization };
  }

  @Query(() => Organization, {
    description: 'Look up an organization by its ID',
  })
  async organization(
    @RequestUser() token: IRequestUser,
    @IdArg() id: string,
  ): Promise<Organization> {
    return this.orgs.readOne(id, token);
  }

  @Query(() => OrganizationListOutput, {
    description: 'Look up organizations',
  })
  async organizations(
    @RequestUser() token: IRequestUser,
    @Args({
      name: 'input',
      type: () => OrganizationListInput,
      defaultValue: OrganizationListInput.defaultVal,
    })
    input: OrganizationListInput,
  ): Promise<OrganizationListOutput> {
    return this.orgs.list(input, token);
  }

  @Mutation(() => UpdateOrganizationOutput, {
    description: 'Update an organization',
  })
  async updateOrganization(
    @RequestUser() token: IRequestUser,
    @Args('input') { organization: input }: UpdateOrganizationInput,
  ): Promise<UpdateOrganizationOutput> {
    const organization = await this.orgs.update(input, token);
    return { organization };
  }

  @Mutation(() => Boolean, {
    description: 'Delete an organization',
  })
  async deleteOrganization(
    @RequestUser() token: IRequestUser,
    @IdArg() id: string,
  ): Promise<boolean> {
    await this.orgs.delete(id, token);
    return true;
  }
}
