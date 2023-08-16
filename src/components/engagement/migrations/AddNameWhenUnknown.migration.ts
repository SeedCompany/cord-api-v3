import { BaseMigration, Migration } from '~/core';
import { InternshipEngagement, LanguageEngagement } from '../dto';

@Migration('2023-07-14T22:49:00')
export class AddNameWhenUnknownMigration extends BaseMigration {
  async up() {
    await this.addProperty(LanguageEngagement, 'nameWhenUnknown', null);
    await this.addProperty(InternshipEngagement, 'nameWhenUnknown', null);
  }
}
