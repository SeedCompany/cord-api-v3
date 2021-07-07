import { ClauseCollection, Query } from 'cypher-query-builder';
import { Many } from '../../../common';

declare module 'cypher-query-builder/dist/typings/query' {
  interface Query<Result = unknown> {
    /**
     * Creates a sub-query clause (`CALL { ... }`) and calls the given function
     * to define it.
     *
     * @example
     * .unwind([0, 1, 2], 'x')
     * .subQuery((sub) => sub
     *   .with('x')
     *   .return('x * 10 as y')
     * )
     * .return(['x', 'y'])
     *
     * @example
     * .unwind([0, 1, 2], 'x')
     * .subQuery('x', (sub) => sub
     *   .return('x * 10 as y')
     * )
     * .return(['x', 'y'])
     */
    subQuery<SubResult>(
      sub: (query: this) => Query<SubResult>
    ): Query<Result & SubResult>;
    subQuery<SubResult>(
      importVars: Many<string>,
      sub: (query: this) => Query<SubResult>
    ): Query<Result & SubResult>;
  }
}

Query.prototype.subQuery = function subQuery(
  subOrImport: Many<string> | ((query: Query) => void),
  maybeSub?: (query: Query) => void
) {
  const subQ = new Query();
  const subClause = new SubQueryClause();
  // @ts-expect-error yeah it's private, but it'll be ok.
  // SubQueryClause is also a ClauseCollection, so it's all good.
  subQ.clauses = subClause;
  if (typeof subOrImport === 'function') {
    subOrImport(subQ);
  } else {
    subQ.with(subOrImport);
    maybeSub!(subQ);
  }

  this.addClause(subClause);

  return this;
};

class SubQueryClause extends ClauseCollection {
  build(): string {
    return [
      `CALL {`,
      ...this.clauses.map((clause) =>
        `  ${clause.build()}`.replace(/\n/g, `\n  `)
      ),
      `}`,
    ].join('\n');
  }
}
