import { node, not, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '~/core';
import { ACTIVE, createProperty, path } from '~/core/database/query';
import { DerivativeScriptureProduct } from '../dto';

@Migration('2021-12-16T00:00:00')
export class AddProductPlaceholderPropMigration extends BaseMigration {
  async up() {
    const res = await this.db
      .query()
      .matchNode('node', 'Product')
      .where(
        not(
          path([
            node('node'),
            relation('out', '', 'placeholderDescription', ACTIVE),
            node('', 'Property'),
          ])
        )
      )
      .apply(
        createProperty({
          resource: DerivativeScriptureProduct,
          key: 'placeholderDescription',
          value: null,
        })
      )
      .return<{ numPropsCreated: number }>(
        'sum(numPropsCreated) as numPropsCreated'
      )
      .first();
    this.logger.info(
      `Placeholder prop added to ${res?.numPropsCreated ?? 0} products`
    );
  }
}
