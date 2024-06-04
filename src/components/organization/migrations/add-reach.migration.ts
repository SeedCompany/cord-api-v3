import { BaseMigration, Migration } from '~/core/database';
import { Organization } from '../dto';

@Migration('2023-08-04T00:00:00')
export class AddOrganizationReachMigration extends BaseMigration {
  async up() {
    await this.addProperty(Organization, 'reach', []);
  }
}
