import { BaseMigration, Migration } from '~/core';
import { Organization } from '../dto';

@Migration('2024-01-25T00:00:00')
export class AddOrganizationReachMigration extends BaseMigration {
  async up() {
    await this.addProperty(Organization, 'website', '');
    await this.addProperty(Organization, 'socialMedia', '');
  }
}
