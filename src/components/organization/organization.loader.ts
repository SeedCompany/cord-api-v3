import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { Organization } from './dto';
import { OrganizationService } from './organization.service';

@LoaderFactory(() => Organization)
export class OrganizationLoader implements DataLoaderStrategy<Organization, ID<Organization>> {
  constructor(private readonly organizations: OrganizationService) {}

  async loadMany(ids: ReadonlyArray<ID<Organization>>) {
    return await this.organizations.readMany(ids);
  }
}
