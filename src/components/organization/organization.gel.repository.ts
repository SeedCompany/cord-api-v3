import { Injectable } from '@nestjs/common';
import { type PublicOf } from '~/common';
import { e, RepoFor } from '~/core/gel';
import { type CreateOrganization, Organization } from './dto';
import { type OrganizationRepository } from './organization.repository';

@Injectable()
export class OrganizationGelRepository
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
