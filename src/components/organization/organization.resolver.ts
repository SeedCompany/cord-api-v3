import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { firstLettersOfWords, IdArg, ISession, Session } from '../../common';
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

@Resolver(Organization)
export class OrganizationResolver {
  constructor(private readonly orgs: OrganizationService) {}

  @Mutation(() => CreateOrganizationOutput, {
    description: 'Create an organization',
  })
  async createOrganization(
    @Session() session: ISession,
    @Args('input') { organization: input }: CreateOrganizationInput
  ): Promise<CreateOrganizationOutput> {
    const organization = await this.orgs.create(input, session);
    return { organization };
  }

  @Query(() => Organization, {
    description: 'Look up an organization by its ID',
  })
  async organization(
    @Session() session: ISession,
    @IdArg() id: string
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
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => OrganizationListInput,
      defaultValue: OrganizationListInput.defaultVal,
    })
    input: OrganizationListInput
  ): Promise<OrganizationListOutput> {
    return this.orgs.list(input, session);
  }

  @Mutation(() => UpdateOrganizationOutput, {
    description: 'Update an organization',
  })
  async updateOrganization(
    @Session() session: ISession,
    @Args('input') { organization: input }: UpdateOrganizationInput
  ): Promise<UpdateOrganizationOutput> {
    const organization = await this.orgs.update(input, session);
    return { organization };
  }

  @Mutation(() => Boolean, {
    description: 'Delete an organization',
  })
  async deleteOrganization(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<boolean> {
    await this.orgs.delete(id, session);
    return true;
  }

  @Query(() => Boolean, {
    description: 'Check all organization nodes for consistency',
  })
  async checkOrganizations(@Session() session: ISession): Promise<boolean> {
    return await this.orgs.checkAllOrgs(session);
  }

  @Query(() => Boolean, {
    description: 'Check Consistency in Organization Nodes',
  })
  async checkOrganizationConsistency(
    @Session() session: ISession
  ): Promise<boolean> {
    return await this.orgs.checkOrganizationConsistency(session);
  }
}
