import { isNotFalsy } from '@seedcompany/common';
import { Query } from 'cypher-query-builder';

export const maybeWhereAnd =
  (...comparisons: Array<string | null | undefined | false>) =>
  (query: Query) => {
    const cleaned = comparisons.filter(isNotFalsy);
    if (cleaned.length === 0) {
      return query;
    }
    return query.raw(`WHERE ${cleaned.join(' AND ')}`);
  };
