import { BaseMigration, Migration } from '~/core';
import { DerivativeScriptureProduct } from '../dto';

@Migration('2021-12-14T00:00:00')
export class AddCompositeMigration extends BaseMigration {
  async up() {
    await this.addProperty(DerivativeScriptureProduct, 'composite', false);
  }
}
