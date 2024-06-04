import { ID } from '~/common';
import { LoaderFactory, OrderedNestDataLoader } from '~/core';
import { Organization } from './dto';
import { OrganizationService } from './organization.service';

@LoaderFactory(() => Organization)
export class OrganizationLoader extends OrderedNestDataLoader<Organization> {
  constructor(private readonly organizations: OrganizationService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.organizations.readMany(ids, this.session);
  }
}
