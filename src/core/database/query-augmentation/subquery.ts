import { Query } from 'cypher-query-builder';
import { Many } from '../../../common';
import { SubClauseCollection } from './SubClauseCollection';

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
      sub: (query: Query<Result>) => Query<SubResult>
    ): Query<Result & SubResult>;
    subQuery<SubResult>(
      importVars: Many<string>,
      sub: (query: Query<Result>) => Query<SubResult>
    ): Query<Result & SubResult>;
  }
}

Query.prototype.subQuery = function subQuery(
  this: Query,
  subOrImport: Many<string> | ((query: Query) => void),
  maybeSub?: (query: Query) => void
) {
  const subClause = new SubQueryClause();
  const subQ = subClause.asQuery();
  if (typeof subOrImport === 'function') {
    subOrImport(subQ);
  } else {
    subQ.with(subOrImport);
    maybeSub!(subQ);
  }

  return this.continueChainClause(subClause);
};

class SubQueryClause extends SubClauseCollection {
  build() {
    return this.wrapBuild('CALL { ', ' }', super.build());
  }
}
