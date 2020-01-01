import { Resolver, Args, Query } from '@nestjs/graphql';
import { Organization } from '../../model/organization';
import { OrganizationService } from './organization.service';

@Resolver(of => Organization)
export class OrganizationResolver {
  constructor(
        private readonly orgService: OrganizationService,
    ) {}

  @Query(returns => Organization)
  async read(@Args('id') id: string) {
    return await this.orgService.readOne(id);
  }
}
