import { BaseMigration, Migration } from '~/core/database';
import { Language } from '../dto';

@Migration('2025-07-04T09:40:00')
export class AddLanguageFlagsMigration extends BaseMigration {
  async up() {
    await this.addProperty(Language, 'isAvailableForReporting', false);
  }
}
