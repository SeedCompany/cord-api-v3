import { BaseMigration, Migration } from '~/core';
import { Partner } from '../dto';

@Migration('2024-01-31T00:00:00')
export class AddWebsiteAndSocialUrlsMigration extends BaseMigration {
  async up() {
    await this.addProperty(Partner, 'websiteUrl', '');
    await this.addProperty(Partner, 'socialUrl', '');
  }
}
