import { Query } from 'cypher-query-builder';

export const fullTextQuery =
  (index: string, query: string, yieldTerms = ['node']) =>
  (q: Query) =>
    q.raw(
      'CALL db.index.fulltext.queryNodes($index, $query)' +
        (yieldTerms && yieldTerms.length > 0
          ? ' YIELD ' + yieldTerms.join(', ')
          : ''),
      {
        index,
        query,
      }
    );
