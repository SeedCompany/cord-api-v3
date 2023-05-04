import { BaseMigration, Migration } from '~/core';
import { IProject } from '../dto';

@Migration('2023-05-04T23:49:00')
export class AddAnticipatedEngagementCountMigration extends BaseMigration {
  async up() {
    await this.addProperty(IProject, 'anticipatedEngagementCount', null);
  }
}
