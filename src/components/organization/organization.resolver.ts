import {
  Resolver,
  Args,
  Query,
  Mutation,
  GraphQLExecutionContext,
  Context,
} from '@nestjs/graphql';
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
    @Context() context: GraphQLExecutionContext,
    @Args('input') { organization: input }: CreateOrganizationInputDto,
  ): Promise<CreateOrganizationOutputDto> {
    const token = context['req']['headers']['token'];
    return await this.orgService.create(input, token);
  }

  @Query(returns => ReadOrganizationOutputDto, {
    description: 'Read one organization by id',
  })
  async readOrganization(
    @Args('input') { organization: input }: ReadOrganizationInputDto,
  ): Promise<ReadOrganizationOutputDto> {
    return await this.orgService.readOne(input);
  }

  @Query(returns => ListOrganizationsOutputDto, {
    description: 'Query orgainzations',
  })
  async organizations(
    @Args('input') { query: input }: ListOrganizationsInputDto,
  ): Promise<ListOrganizationsOutputDto> {
    return await this.orgService.queryOrganizations(input);
  }

  @Mutation(returns => UpdateOrganizationOutputDto, {
    description: 'Update an organization',
  })
  async updateOrganization(
    @Args('input')
    { organization: input }: UpdateOrganizationInputDto,
  ): Promise<UpdateOrganizationOutputDto> {
    return await this.orgService.update(input);
  }

  @Mutation(returns => DeleteOrganizationOutputDto, {
    description: 'Delete an organization',
  })
  async deleteOrganization(
    @Args('input')
    { organization: input }: DeleteOrganizationInputDto,
  ): Promise<DeleteOrganizationOutputDto> {
    return await this.orgService.delete(input);
  }
}
