import { hasLabel, node, not, relation } from 'cypher-query-builder';
import { asyncPool, ID, Range } from '../../../common';
import { BaseMigration, Migration } from '../../../core';
import {
  ACTIVE,
  collect,
  createProperty,
  path,
} from '../../../core/database/query';
import {
  getTotalVerseEquivalents,
  getTotalVerses,
  getVerseEquivalentsFromUnspecified,
  ScriptureRange,
  UnspecifiedScripturePortion,
} from '../../scripture';
import { DirectScriptureProduct } from '../dto';

interface ProductRef {
  id: ID;
  scriptureRanges: ReadonlyArray<Range<number>>;
  unspecifiedScripture: UnspecifiedScripturePortion | null;
}

@Migration('2021-12-10T00:00:00')
export class AddProductTotalVersesMigration extends BaseMigration {
  async up() {
    const products = await this.findProductRefsWithoutTotalVerses();
    this.logger.info(`Found ${products.length} products without total verses`);

    await asyncPool(5, products, async (product, i) => {
      const totalVerses = product.unspecifiedScripture
        ? product.unspecifiedScripture.totalVerses
        : getTotalVerses(
            ...product.scriptureRanges.map(ScriptureRange.fromIds)
          );
      const totalVerseEquivalents = product.unspecifiedScripture
        ? getVerseEquivalentsFromUnspecified(product.unspecifiedScripture)
        : getTotalVerseEquivalents(
            ...product.scriptureRanges.map(ScriptureRange.fromIds)
          );

      await this.save(product, totalVerses, totalVerseEquivalents);

      this.logger.info(`Saved product ${i} / ${products.length}`, {
        id: product.id,
        totalVerses,
        totalVerseEquivalents,
      });
    });
  }

  private async findProductRefsWithoutTotalVerses() {
    const res = await this.db
      .query()
      .matchNode('node', 'Product')
      .where({
        node: [
          hasLabel('DirectScriptureProduct'),
          hasLabel('DerivativeScriptureProduct'),
        ],
        noProp: not(
          path([
            node('node'),
            relation('out', '', 'totalVerses'),
            node('', 'Property'),
          ])
        ),
      })
      .optionalMatch([
        node('node'),
        relation('out', '', 'unspecifiedScripture', ACTIVE),
        node('unspecifiedScripture', 'UnspecifiedScripturePortion'),
      ])
      .subQuery('node', (sub) =>
        sub
          .match([
            node('node'),
            relation('out', '', undefined, ACTIVE),
            node('scriptureRanges', 'ScriptureRange'),
          ])
          .return(
            collect('scriptureRanges { .start, .end }').as('scriptureRanges')
          )
      )
      .logIt()
      .return<ProductRef>([
        'node.id as id',
        'scriptureRanges',
        'unspecifiedScripture { .book, .totalVerses } as unspecifiedScripture',
      ])
      .run();
    return res;
  }

  private async save(
    row: ProductRef,
    totalVerses: number,
    totalVerseEquivalents: number
  ) {
    await this.db
      .query()
      .matchNode('node', 'Product', { id: row.id })
      .apply(
        createProperty({
          resource: DirectScriptureProduct,
          key: 'totalVerses',
          value: totalVerses,
          numCreatedVar: 'numTvCreated',
        })
      )
      .apply(
        createProperty({
          resource: DirectScriptureProduct,
          key: 'totalVerseEquivalents',
          value: totalVerseEquivalents,
          numCreatedVar: 'numTveCreated',
        })
      )
      .return('numTvCreated, numTveCreated')
      .first();
  }
}
