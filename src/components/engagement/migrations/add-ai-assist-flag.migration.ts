import { BaseMigration, Migration } from '~/core/database';
import { LanguageEngagement } from '../dto';

@Migration('2024-12-18T12:00:00')
export class AddAiAssistFlagMigration extends BaseMigration {
  async up() {
    await this.addProperty(
      LanguageEngagement,
      'usingAIAssistedTranslation',
      null,
    );
  }
}
