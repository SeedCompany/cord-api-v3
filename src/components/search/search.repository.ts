import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { CommonRepository, OnIndex, OnIndexParams } from '~/core/database';
import {
  ACTIVE,
  escapeLuceneSyntax,
  FullTextIndex,
} from '~/core/database/query';
import { BaseNode } from '~/core/database/results';
import { SearchInput } from './dto';

@Injectable()
export class SearchRepository extends CommonRepository {
  @OnIndex('schema')
  protected async applyIndexes({ db }: OnIndexParams) {
    await db.query().apply(GlobalIndex.create()).run();
  }

  /**
   * Search for nodes based on input, only returning their id and "type"
   * which is based on their first valid search label.
   */
  async search(input: SearchInput) {
    const escaped = escapeLuceneSyntax(input.query);
    // Emphasize exact matches but allow fuzzy as well
    const lucene = `"${escaped}"^2 ${escaped}*`;

    const query = this.db
      .query()
      .subQuery((q) =>
        q
          .matchNode('node', 'BaseNode', { id: input.query })
          .return(['node', '["id"] as matchedProps'])

          .union()

          .call(GlobalIndex.search(lucene).yield({ node: 'property' }))
          .match([node('node'), relation('out', 'r', ACTIVE), node('property')])
          .return(['node', 'collect(type(r)) as matchedProps'])
          // The input.count is going to be applied once the results are 'filtered'
          // according to what the user can read. This limit is just set to a bigger
          // number, so we don't choke things without a limit.
          .raw('LIMIT 100'),
      )
      .apply((q) =>
        input.type
          ? q
              .with(['node', 'matchedProps'])
              .raw('WHERE any(l in labels(node) where l in $types)', {
                types: input.type,
              })
          : q,
      )
      .return<{
        node: BaseNode;
        matchedProps: readonly string[];
      }>(['node', 'matchedProps']);

    return await query.run();
  }
}

const GlobalIndex = FullTextIndex({
  indexName: 'propValue',
  labels: 'Property',
  properties: 'value',
  analyzer: 'standard-folding',
});
