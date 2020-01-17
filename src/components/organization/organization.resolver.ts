import {
  Resolver,
  Args,
  Query,
  Mutation,
  Context,
} from '@nestjs/graphql';
import { GqlContextType } from '../../common';
import { Organization } from './organization';
import { OrganizationService } from './organization.service';
import {
  CreateOrganizationInputDto,
  CreateOrganizationOutputDto,
  ReadOrganizationInputDto,
  ReadOrganizationOutputDto,
  UpdateOrganizationInputDto,
  UpdateOrganizationOutputDto,
  DeleteOrganizationInputDto,
  DeleteOrganizationOutputDto,
  ListOrganizationsOutputDto,
  ListOrganizationsInputDto,
} from './organization.dto';

@Resolver(of => Organization)
export class OrganizationResolver {
  constructor(private readonly orgService: OrganizationService) {}

  @Mutation(returns => CreateOrganizationOutputDto, {
    description: 'Create an organization',
  })
  async createOrganization(
    @Context() { token }: GqlContextType,
    @Args('input') { organization: input }: CreateOrganizationInputDto,
  ): Promise<CreateOrganizationOutputDto> {
    return await this.orgService.create(input, token);
  }

  @Query(returns => ReadOrganizationOutputDto, {
    description: 'Read one organization by id',
  })
  async readOrganization(
    @Context() { token }: GqlContextType,
    @Args('input') { organization: input }: ReadOrganizationInputDto,
  ): Promise<ReadOrganizationOutputDto> {
    return await this.orgService.readOne(input, token);
  }

  @Query(returns => ListOrganizationsOutputDto, {
    description: 'Query orgainzations',
  })
  async organizations(
    @Context() { token }: GqlContextType,
    @Args('input') { query: input }: ListOrganizationsInputDto,
  ): Promise<ListOrganizationsOutputDto> {
    return await this.orgService.queryOrganizations(input, token);
  }

  @Mutation(returns => UpdateOrganizationOutputDto, {
    description: 'Update an organization',
  })
  async updateOrganization(
    @Context() { token }: GqlContextType,
    @Args('input')
    { organization: input }: UpdateOrganizationInputDto,
  ): Promise<UpdateOrganizationOutputDto> {
    return await this.orgService.update(input, token);
  }

  @Mutation(returns => DeleteOrganizationOutputDto, {
    description: 'Delete an organization',
  })
  async deleteOrganization(
    @Context() { token }: GqlContextType,
    @Args('input')
    { organization: input }: DeleteOrganizationInputDto,
  ): Promise<DeleteOrganizationOutputDto> {
    return await this.orgService.delete(input, token);
  }
}
