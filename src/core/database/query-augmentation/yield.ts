import { Many } from '@seedcompany/common';
import { Clause, Query } from 'cypher-query-builder';

declare module 'cypher-query-builder/dist/typings/query' {
  interface Query {
    yield(...terms: Array<Many<string>>): this;
  }
}

Query.prototype.yield = function (this: Query, ...terms: Array<Many<string>>) {
  const flattened = terms.flat();
  if (flattened.length === 0) return this;
  return this.continueChainClause(new Yield(flattened));
};

class Yield extends Clause {
  constructor(public terms: readonly string[]) {
    super();
  }
  build() {
    return `YIELD ${this.terms.join(', ')}`;
  }
}
