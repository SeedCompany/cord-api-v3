import { BaseMigration, Migration } from '~/core';
import { Product } from '../dto';

@Migration('2022-02-09T00:00:00')
export class AddProductStepsMigration extends BaseMigration {
  async up() {
    await this.addProperty(Product, 'steps', []);
  }
}
