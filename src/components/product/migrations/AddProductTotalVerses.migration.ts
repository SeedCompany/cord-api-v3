import { BaseMigration, Migration } from '../../../core';

@Migration('2021-11-27T00:00:00')
export class AddProductTotalVersesMigration extends BaseMigration {
  async up() {
    // TODO Find all products without total verses and calculate and update
  }
}
