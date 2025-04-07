import { isNotFalsy, many, Many, setOf } from '@seedcompany/common';
import { Query } from 'cypher-query-builder';
import { Variable } from './condition-variables';
import { withParent } from './root';
import { SubClauseCollection } from './SubClauseCollection';

declare module 'cypher-query-builder/dist/typings/query' {
  interface Query<Result = unknown> {
    /**
     * Creates a sub-query clause (`CALL (...) { ... }`) and calls the given function
     * to define it.
     *
     * @example
     * .subQuery((sub) => sub
     *   .match(node('user', 'User', { id }))
     *   .return('user')
     * )
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
  const importsRaw = typeof subOrImport === 'function' ? [] : subOrImport!;
  const sub = typeof subOrImport === 'function' ? subOrImport : maybeSub!;

  const imports = [
    ...setOf(
      many(importsRaw)
        .flatMap((val) => (val instanceof Variable ? varInExp(val) : val))
        .filter(isNotFalsy),
    ),
  ];

  const subClause = new SubQueryClause(imports);
  const subQ = withParent(subClause.asQuery(), this);
  sub(subQ);

  return this.continueChainClause(subClause);
};

class SubQueryClause extends SubClauseCollection {
  constructor(readonly scope: string[]) {
    super();
  }

  build() {
    return this.wrapBuild(
      `CALL (${this.scope.join(', ')}) { `,
      ' }',
      super.build(),
    );
  }
}

// Try to pull the root variable referenced from expression https://regex101.com/r/atshF5
export const varInExp = (variable: string | Variable) =>
  variable.toString().startsWith('$')
    ? ''
    : /(?:.+\()?([^.]+)\.?.*/.exec(variable.toString())?.[1] ?? '';
