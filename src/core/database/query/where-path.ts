import { Merge } from 'cypher-query-builder';
import { PatternCollection } from 'cypher-query-builder/dist/typings/clauses/pattern-clause';
import { Comparator } from 'cypher-query-builder/dist/typings/clauses/where-comparators';

/**
 * A path condition for a WHERE clause.
 * It doesn't matter what key this is assigned to it - it is ignored.
 */
export const path = (
  pattern: Exclude<PatternCollection, any[][]>
): Comparator => {
  // Using merge as shortcut to compile path to string.
  const clause = new Merge(pattern);
  return (params) => {
    if (clause.getParameterBag() !== params) {
      clause.useParameterBag(params);
    }
    // Slice off the "MERGE " prefix from built clause.
    return clause.build().slice(6);
  };
};
