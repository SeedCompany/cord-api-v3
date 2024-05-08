import { Injectable } from '@nestjs/common';
import { PublicOf } from '~/common';
import { e, RepoFor } from '~/core/edgedb';
import { CreateOrganization, Organization } from './dto';
import { OrganizationRepository } from './organization.repository';

@Injectable()
export class OrganizationEdgeDBRepository
  extends RepoFor(Organization, {
    hydrate: (organization) => organization['*'],
    omit: ['create'],
  })
  implements PublicOf<OrganizationRepository>
{
  async create(input: CreateOrganization) {
    return await this.defaults.create({
      ...input,
      projectContext: e.insert(e.Project.Context, {}),
    });
  }
}
