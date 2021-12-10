import { node, not, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '../../../core';
import { createProperty, path } from '../../../core/database/query';
import { DirectScriptureProduct } from '../dto';

@Migration('2021-11-27T00:00:00')
export class AddProductTotalVersesMigration extends BaseMigration {
  async up() {
    const res = await this.db
      .query()
      .match([
        node('node', 'Product'),
        relation('out', '', 'unspecifiedScripture'),
        node('usp', 'UnspecifiedScripturePortion'),
      ])
      .where(
        not(
          path([
            node('node'),
            relation('out', '', 'totalVerses'),
            node('', 'Property'),
          ])
        )
      )
      .apply(
        createProperty({
          resource: DirectScriptureProduct,
          key: 'totalVerses',
          variable: 'usp.totalVerses',
          numCreatedVar: 'unspecifiedScripturePortions',
        })
      )
      .with(
        'sum(unspecifiedScripturePortions) as unspecifiedScripturePortionTotalVerses'
      )
      .match([
        node('node', 'Product'),
        relation('out'),
        node('sr', 'ScriptureRange'),
      ])
      .where(
        not(
          path([
            node('node'),
            relation('out', '', 'totalVerses'),
            node('', 'Property'),
          ])
        )
      )
      .apply(
        createProperty({
          resource: DirectScriptureProduct,
          key: 'totalVerses',
          variable: 'sr.end - sr.start + 1',
          numCreatedVar: 'scriptureRanges',
        })
      )
      .return<{ numTotalVersesPropAdded: number }>(
        'sum(scriptureRanges) + unspecifiedScriptureTotalVerses as numTotalVersesPropAdded'
      )
      .first();

    this.logger.info(
      `totalVerses property added to ${
        res?.numTotalVersesPropAdded ?? 0
      } products`
    );
  }
}
