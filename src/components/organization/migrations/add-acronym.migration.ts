import { BaseMigration, Migration } from '~/core';
import { Organization } from '../dto';

@Migration('2023-07-25T00:00:00')
export class AddOrganizationAcronymMigration extends BaseMigration {
  async up() {
    await this.addProperty(Organization, 'acronym', null);
  }
}
