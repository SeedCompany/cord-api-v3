import { node, relation } from 'cypher-query-builder';
import { type ID } from '~/common';
import { BaseMigration, Migration } from '~/core/database';
import { ACTIVE } from '~/core/database/query';
import { getTotalVerseEquivalents } from '../../scripture';
import { ProductService } from '../product.service';

@Migration('2023-10-27T09:47:07')
export class FixNaNTotalVerseEquivalentsMigration extends BaseMigration {
  constructor(private readonly productService: ProductService) {
    super();
  }

  async up() {
    const ids = await this.db
      .query()
      .match([
        node('product', 'Product'),
        relation('out', '', 'totalVerseEquivalents', ACTIVE),
        node('tve', 'Property'),
      ])
      .raw('WHERE tve.hadNaN = true or isNaN(tve.value)')
      .return<{ id: ID }>('product.id as id')
      .map('id')
      .run();

    const products = await this.productService.readManyUnsecured(ids);

    for (const p of products) {
      const correctTotalVerseEquivalent = getTotalVerseEquivalents(
        ...p.scriptureReferences,
      );

      if (p.__typename === 'DirectScriptureProduct') {
        await this.productService.updateDirect({
          id: p.id,
          totalVerseEquivalents: correctTotalVerseEquivalent,
        });
      }
      if (p.__typename === 'DerivativeScriptureProduct') {
        await this.productService.updateDerivative({
          id: p.id,
          totalVerseEquivalents: correctTotalVerseEquivalent,
        });
      }
    }
  }
}
