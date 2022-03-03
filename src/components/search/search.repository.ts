import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { CommonRepository, OnIndex, OnIndexParams } from '../../core';
import {
  ACTIVE,
  escapeLuceneSyntax,
  fullTextQuery,
} from '../../core/database/query';
import { BaseNode } from '../../core/database/results';
import { SearchInput, SearchResult } from './dto';

@Injectable()
export class SearchRepository extends CommonRepository {
  @OnIndex('schema')
  protected async applyIndexes({ db }: OnIndexParams) {
    await db.createFullTextIndex('propValue', ['Property'], ['value'], {
      analyzer: 'standard-folding',
    });
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
          .return(['node', '"id" as matchedProp'])

          .union()

          .raw('', { query: lucene })
          .apply(fullTextQuery('propValue', '$query', ['node as property']))
          .match([node('node'), relation('out', 'r', ACTIVE), node('property')])
          .return(['node', 'type(r) as matchedProp'])
          // The input.count is going to be applied once the results are 'filtered'
          // according to what the user can read. This limit is just set to a bigger
          // number, so we don't choke things without a limit.
          .raw('LIMIT 100')
      )
      .apply((q) =>
        input.type
          ? q
              .with(['node', 'matchedProp'])
              .raw(
                'WHERE size([l in labels(node) where l in $types | 1]) > 0',
                { types: input.type }
              )
          : q
      )
      .returnDistinct<{
        node: BaseNode;
        matchedProp: keyof SearchResult;
      }>(['node', 'matchedProp']);

    return await query.run();
  }
}
