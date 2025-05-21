import { BaseMigration, Migration } from '~/core/database';
import { ProjectMember } from '../dto';

@Migration('2025-05-21T00:00:00')
export class AddInactiveAtMigration extends BaseMigration {
  async up() {
    await this.addProperty(ProjectMember, 'inactiveAt', null);
  }
}
