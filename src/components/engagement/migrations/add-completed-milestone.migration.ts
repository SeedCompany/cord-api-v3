import { BaseMigration, Migration } from '~/core/database';
import { LanguageEngagement } from '../dto';

@Migration('2025-10-06T10:00:00')
export class AddCompletedMilestoneMigration extends BaseMigration {
  async up() {
    await this.addProperty(LanguageEngagement, 'completedMilestone', false);
  }
}
