import { BaseMigration, Migration } from '~/core/neo4j';
import { Organization } from '../dto';

@Migration('2025-07-02T18:11:16')
export class AddOrganizationTypeMigration extends BaseMigration {
  async up() {
    await this.addProperty(Organization, 'types', []);
  }
}
