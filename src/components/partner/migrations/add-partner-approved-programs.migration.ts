import { BaseMigration, Migration } from '~/core/database';
import { Partner } from '../dto';

@Migration('2024-12-19T11:00:00')
export class AddPartnerApprovedProgramsMigration extends BaseMigration {
  async up() {
    await this.addProperty(Partner, 'approvedPrograms', []);
  }
}
