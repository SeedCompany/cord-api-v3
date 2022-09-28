import { node, not, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '~/core';
import { ACTIVE, createProperty, path } from '~/core/database/query';
import { DerivativeScriptureProduct } from '../dto';

@Migration('2021-12-14T00:00:00')
export class AddCompositeMigration extends BaseMigration {
  async up() {
    const res = await this.db
      .query()
      .matchNode('node', 'DerivativeScriptureProduct')
      .where(
        not(
          path([
            node('node'),
            relation('out', '', 'composite', ACTIVE),
            node('', 'Property'),
          ])
        )
      )
      .apply(
        createProperty({
          resource: DerivativeScriptureProduct,
          key: 'composite',
          value: false,
          numCreatedVar: 'numCompositeCreated',
        })
      )
      .return<{ numCompositeCreated: number }>(
        'sum(numCompositeCreated) as numCompositeCreated'
      )
      .first();
    this.logger.info(
      `Composite prop added to ${res?.numCompositeCreated ?? 0} products`
    );
  }
}
