import { Query } from 'cypher-query-builder';
import { compact, uniq } from 'lodash';
import { many, Many } from '../../../common';
import { Variable } from './condition-variables';
import { withParent } from './root';
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
      sub: (query: Query<Result>) => Query<SubResult>,
    ): Query<Result & SubResult>;
    subQuery<SubResult>(
      importVars: Many<string | Variable | null | undefined>,
      sub: (query: Query<Result>) => Query<SubResult>,
    ): Query<Result & SubResult>;
  }
}

Query.prototype.subQuery = function subQuery(
  this: Query,
  subOrImport:
    | Many<string | Variable | null | undefined>
    | ((query: Query) => void),
  maybeSub?: (query: Query) => void,
) {
  const subClause = new SubQueryClause();
  const subQ = withParent(subClause.asQuery(), this);
  if (typeof subOrImport === 'function') {
    subOrImport(subQ);
  } else {
    const imports = uniq(
      compact(
        many(subOrImport).flatMap((val) =>
          val instanceof Variable ? varInExp(val) : val,
        ),
      ),
    );
    subQ.with(imports);
    maybeSub!(subQ);
  }

  return this.continueChainClause(subClause);
};

class SubQueryClause extends SubClauseCollection {
  build() {
    return this.wrapBuild('CALL { ', ' }', super.build());
  }
}

// Try to pull the root variable referenced from expression https://regex101.com/r/atshF5
export const varInExp = (variable: string | Variable) =>
  variable.toString().startsWith('$')
    ? ''
    : /(?:.+\()?([^.]+)\.?.*/.exec(variable.toString())?.[1] ?? '';
