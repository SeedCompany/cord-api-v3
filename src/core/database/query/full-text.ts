import { Query } from 'cypher-query-builder';

/**
 * Query a full text index for results.
 *
 * NOTE: the `query` is Lucene syntax. If this is coming from user input, consider
 * using the {@link escapeLuceneSyntax} function.
 */
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
        // fallback to "" when no query is given, so that no results are
        // returned instead of the procedure failing
        query: query.trim() || '""',
      },
    );

export const escapeLuceneSyntax = (query: string) =>
  query
    .replace(/[![\]~)(+\-:?*"^&|{}\\/]/g, (char) => `\\${char}`)
    .replace(/\b(OR|AND|NOT)\b/g, (char) => `"${char}"`);
