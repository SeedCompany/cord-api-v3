import { BaseMigration, Migration } from '~/core/database';
import { LanguageEngagement } from '../dto';

@Migration('2024-12-12T10:00:00')
export class AddMilestoneReachedMigration extends BaseMigration {
  async up() {
    await this.addProperty(LanguageEngagement, 'milestoneReached', 'Unknown');
  }
}
