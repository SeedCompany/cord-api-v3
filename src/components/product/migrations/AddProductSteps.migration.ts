import { node, not, relation } from 'cypher-query-builder';
import { Product } from '..';
import { BaseMigration, Migration } from '../../../core';
import { ACTIVE, createProperty, path } from '../../../core/database/query';

@Migration('2022-02-09T00:00:00')
export class AddProductStepsMigration extends BaseMigration {
  async up() {
    const res = await this.db
      .query()
      .matchNode('node', 'Product')
      .where(
        not(
          path([
            node('node'),
            relation('out', '', 'steps', ACTIVE),
            node('', 'Property'),
          ])
        )
      )
      .apply(
        createProperty({
          resource: Product,
          key: 'steps',
          value: [],
        })
      )
      .return<{ numPropsCreated: number }>(
        'sum(numPropsCreated) as numPropsCreated'
      )
      .first();
    this.logger.info(
      `Steps prop added to ${res?.numPropsCreated ?? 0} products`
    );
  }
}
