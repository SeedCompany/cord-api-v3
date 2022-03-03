import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { ID, Session } from '../../common';
import { DatabaseService, OnIndex, OnIndexParams } from '../../core';
import {
  ACTIVE,
  escapeLuceneSyntax,
  fullTextQuery,
  matchRequestingUser,
} from '../../core/database/query';
import { SearchInput, SearchResult, SearchResultMap } from './dto';

@Injectable()
export class SearchRepository {
  constructor(private readonly db: DatabaseService) {}

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
  async search(input: SearchInput, session: Session) {
    const escaped = escapeLuceneSyntax(input.query);
    // Emphasize exact matches but allow fuzzy as well
    const lucene = `"${escaped}"^2 ${escaped}*`;

    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .raw('', {
        types: input.type ?? [],
        query: lucene,
      })
      .apply(fullTextQuery('propValue', '$query', ['node as property']))
      .apply(propToBaseNode())
      .apply(filterToRequested())
      .returnDistinct<{
        id: ID;
        matchedProp: keyof SearchResult;
        type: keyof SearchResultMap;
      }>([
        'node.id as id',
        'type(r) as matchedProp',
        `[l in labels(node) where l in $types][0] as type`,
      ])
      // The input.count is going to be applied once the results are 'filtered'
      // according to what the user can read. This limit is just set to a bigger
      // number, so we don't choke things without a limit.
      .raw('LIMIT 100');

    return await query.run();
  }
}

const propToBaseNode = () => (query: Query) =>
  query.match([node('node'), relation('out', 'r', ACTIVE), node('property')]);

const filterToRequested = () => (query: Query) =>
  query.raw(
    `
      WHERE size([l in labels(node) where l in $types | 1]) > 0
    `
  );
