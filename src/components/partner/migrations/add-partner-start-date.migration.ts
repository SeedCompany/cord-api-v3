import { BaseMigration, Migration } from '~/core/database';
import { Partner } from '../dto';

@Migration('2025-04-24T14:00:00')
export class AddPartnerStartDateMigration extends BaseMigration {
  async up() {
    await this.addProperty(Partner, 'startDate', null);
  }
}
