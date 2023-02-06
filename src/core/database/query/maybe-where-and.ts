import { Query } from 'cypher-query-builder';
import { compact } from 'lodash';

export const maybeWhereAnd =
  (...comparisons: Array<string | null | undefined | false>) =>
  (query: Query) => {
    const cleaned = compact(comparisons);
    if (cleaned.length === 0) {
      return query;
    }
    return query.raw(`WHERE ${cleaned.join(' AND ')}`);
  };
