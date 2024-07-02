import { groupBy } from '@seedcompany/common';
import { node } from 'cypher-query-builder';
import { uniq } from 'lodash';
import { ID } from '~/common';
import { BaseMigration, Migration } from '~/core/database';
import { updateProperty, variable } from '~/core/database/query';
import { ProductMedium as Medium, Product } from '../dto';
import { ProductService } from '../product.service';

@Migration('2024-07-01T09:00:00')
export class BackfillEmptyMediumsMigration extends BaseMigration {
  constructor(private readonly productService: ProductService) {
    super();
  }

  async up() {
    const engagements = await this.db.query<{
      products: Array<{ id: ID; mediums: Medium[] }>;
    }>().raw`
      match (eng:Engagement)
      where exists((eng)-[:product { active: true }]->(:Product)-[:mediums { active: true }]->(:Property { value: [] }))
      match (eng)-[:product { active: true }]->(prod:Product)-[:mediums { active: true }]->(mediums:Property)
      with eng, collect({ id: prod.id, mediums: mediums.value }) as products
      where any(product in products where size(product.mediums) > 0)
      return products
    `.run();
    this.logger.notice(
      `Found ${engagements.length} engagements with some empty mediums`,
    );

    const updates = engagements.flatMap(({ products }) => {
      const grouped = groupBy(products, (p) =>
        uniq(p.mediums)
          .sort((a, b) => a.localeCompare(b))
          .join(';'),
      );
      if (grouped.length > 2) {
        return [];
      }
      const [nonEmpties, empties] =
        grouped[0][0].mediums.length > 0 ? grouped : grouped.toReversed();

      const mediums = nonEmpties[0].mediums;
      return empties.map((p) => ({ id: p.id, mediums }));
    });
    this.logger.notice(
      `Resolves to ${updates.length} products to assign mediums to`,
    );

    await this.db
      .query()
      .unwind(updates, 'update')
      .match(node('node', 'Product', { id: variable('update.id') }))
      .apply(
        updateProperty({
          resource: Product,
          key: 'mediums',
          value: variable('update.mediums'),
        }),
      )
      .return<{ id: ID }>('node.id as id')
      .executeAndLogStats();
  }
}
