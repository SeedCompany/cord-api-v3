import { Query } from 'cypher-query-builder';
import { SubClauseCollection } from './SubClauseCollection';

declare module 'cypher-query-builder/dist/typings/query' {
  interface Query {
    /**
     * Creates a FOREACH clause and calls the given function
     * to define it.
     *
     * @example
     * .forEach('n', 'nodes(p)', 'SET n.marked = true')
     *
     * @example
     * // In part from https://www.markhneedham.com/blog/2014/04/19/neo4j-cypher-creating-a-time-tree-down-to-the-day/
     * .with([
     *   'range(2011, 2014) as years',
     *   'range(1, 12) as months',
     * ])
     * .forEach('year', 'years', (year) => year
     *   .merge(node('y', 'Year', { year: variable('year') }))
     *   .forEach('month', 'months', (month) => month
     *     .createNode('m', 'Month', { month: variable('month') })
     *     .merge([node('y'), relation('out', '', 'HAS_MONTH'), node('m')])
     *   )
     * )
     *
     * @see https://neo4j.com/docs/cypher-manual/current/clauses/foreach/
     */
    forEach(
      variable: string,
      list: string,
      each: string | ((query: Query) => Query)
    ): this;
  }
}

Query.prototype.forEach = function forEach(
  this: Query,
  variable: string,
  list: string,
  each: string | ((query: Query) => Query)
) {
  const clause = new ForEachClause(variable, list);
  const q = clause.asQuery();
  typeof each === 'string' ? q.raw(each) : each(q);
  return this.continueChainClause(clause);
};

class ForEachClause extends SubClauseCollection {
  constructor(
    private readonly variable: string,
    private readonly list: string
  ) {
    super();
  }

  build() {
    return this.wrapBuild(
      `FOREACH (${this.variable} IN ${this.list} | `,
      ')',
      super.build()
    );
  }
}
