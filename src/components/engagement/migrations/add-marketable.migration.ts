import { BaseMigration, Migration } from '~/core/database';
import { InternshipEngagement } from '../dto';

@Migration('2025-09-25T10:00:00')
export class AddMarketableMigration extends BaseMigration {
  async up() {
    await this.addProperty(InternshipEngagement, 'marketable', false);
  }
}
