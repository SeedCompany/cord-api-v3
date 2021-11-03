import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { ID, Session } from '../../common';
import {
  DatabaseService,
  matchRequestingUser,
  OnIndex,
  OnIndexParams,
} from '../../core';
import {
  ACTIVE,
  escapeLuceneSyntax,
  fullTextQuery,
} from '../../core/database/query';
import { SearchInput, SearchResultMap } from './dto';

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
      .apply(
        // Ignore authorization if only searching for EthnoArt
        // This is a temporary fix while authorization refactor is in progress
        input.type?.join(',') === 'EthnoArt'
          ? null
          : filterToRequestedAndAllowed()
      )
      .returnDistinct<{ id: ID; type: keyof SearchResultMap }>([
        'node.id as id',
        `[l in labels(node) where l in $types][0] as type`,
      ])
      .limit(input.count);

    return await query.run();
  }
}

const propToBaseNode = () => (query: Query) =>
  query.match([node('node'), relation('out', 'r', ACTIVE), node('property')]);

const filterToRequestedAndAllowed = () => (query: Query) =>
  query.raw(
    `
      WHERE size([l in labels(node) where l in $types | 1]) > 0
        AND exists(
          (node)<-[:baseNode]-(:Permission { property: type(r), read: true })
                <-[:permission]-(:SecurityGroup)
                 -[:member]->(requestingUser)
        )
    `
  );
