import { BaseMigration, Migration } from '~/core';
import { Product } from '../dto';

@Migration('2021-12-16T00:00:00')
export class AddProductPlaceholderPropMigration extends BaseMigration {
  async up() {
    await this.addProperty(Product, 'placeholderDescription', null);
  }
}
