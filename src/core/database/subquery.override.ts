import { ClauseCollection, Query } from 'cypher-query-builder';
import { repeat } from 'lodash';

/* eslint-disable @typescript-eslint/method-signature-style -- this is enforced
   to treat functions arguments as contravariant instead of bivariant. this
   doesn't matter here as this class won't be overridden. Declaring them as
   methods keeps their color the same as the rest of the query methods. */

declare module 'cypher-query-builder/dist/typings/query' {
  interface Query {
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
     */
    subQuery(sub: (query: this) => void): this;
  }
}

Query.prototype.subQuery = function subQuery(sub: (query: Query) => void) {
  type Q = Query & {
    indentationLevel?: number;
  };
  const self = this as Q;
  const subQ = new Query() as Q;
  subQ.indentationLevel = (self.indentationLevel || 0) + 1;
  const subClause = new SubQueryClause(self.indentationLevel);
  // @ts-expect-error yeah it's private, but it'll be ok.
  // SubQueryClause is also a ClauseCollection so it's all good.
  subQ.clauses = subClause;
  sub(subQ);

  this.addClause(subClause);

  return this;
};

class SubQueryClause extends ClauseCollection {
  constructor(private readonly indentationLevel = 0) {
    super();
  }

  build(): string {
    return [
      `CALL {`,
      ...this.clauses.map(
        (clause) =>
          `${repeat('  ', this.indentationLevel + 1)}${clause.build()}`
      ),
      `${repeat('  ', this.indentationLevel)}}`,
    ].join('\n');
  }
}
