import { node, relation } from 'cypher-query-builder';
import { ID } from '~/common';
import { BaseMigration, Migration } from '~/core/database';
import { ACTIVE } from '~/core/database/query';
import { getTotalVerseEquivalents } from '../../scripture/verse-equivalents';
import { ProductService } from '../product.service';

@Migration('2023-10-27T09:47:07')
export class FixNaNTotalVerseEquivalentsMigration extends BaseMigration {
  constructor(private readonly productService: ProductService) {
    super();
  }

  async up() {
    const session = this.fakeAdminSession;
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

    const products = await this.productService.readManyUnsecured(
      ids,
      this.fakeAdminSession,
    );

    for (const p of products) {
      const correctTotalVerseEquivalent = getTotalVerseEquivalents(
        ...p.scriptureReferences,
      );

      if (p.__typename === 'DirectScriptureProduct') {
        await this.productService.updateDirect(
          { id: p.id, totalVerseEquivalents: correctTotalVerseEquivalent },
          session,
        );
      }
      if (p.__typename === 'DerivativeScriptureProduct') {
        await this.productService.updateDerivative(
          { id: p.id, totalVerseEquivalents: correctTotalVerseEquivalent },
          session,
        );
      }
    }
  }
}
