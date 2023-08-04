import { BaseMigration, Migration } from '~/core';
import { Organization } from '../dto';

@Migration('2023-08-04T00:00:00')
export class AddOrganizationTypeMigration extends BaseMigration {
  async up() {
    await this.addProperty(Organization, 'types', []);
  }
}
