import { Resolver, Args, Query, Mutation } from '@nestjs/graphql';
import { Organization } from '../../model/organization';
import { OrganizationService } from './organization.service';

@Resolver(of => Organization)
export class OrganizationResolver {
  constructor(private readonly orgService: OrganizationService) {}

  @Mutation(returns => Organization, {
    description: 'Add an organization',
  })
  async createOrganization(@Args('name') name: string) {
    return await this.orgService.create(name);
  }

  @Query(returns => Organization, {
    description: 'Read an organization by id'
  })
  async readOrganization(@Args('id') id: string) {
    return await this.orgService.readOne(id);
  }
}
