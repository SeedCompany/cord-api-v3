import { BaseMigration, Migration } from '~/core';
import { IProject } from '../dto';

@Migration('2021-09-09T22:49:00')
export class AddPresetInventoryMigration extends BaseMigration {
  async up() {
    await this.addProperty(IProject, 'presetInventory', false);
  }
}
