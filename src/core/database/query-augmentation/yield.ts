import { isPlainObject } from '@nestjs/common/utils/shared.utils.js';
import { isNotFalsy, many, Many, Nil } from '@seedcompany/common';
import { Clause, Query } from 'cypher-query-builder';

declare module 'cypher-query-builder/dist/typings/query' {
  interface Query {
    yield(terms: YieldTerms): this;
  }
}

export type YieldTerms<T extends string = string> =
  | Many<T | Nil>
  | Partial<Record<T, string | boolean | Nil>>;

Query.prototype.yield = function (this: Query, terms: YieldTerms) {
  const flattened = isPlainObject(terms)
    ? Object.entries(terms).flatMap(([k, v]) =>
        v === false || v == null ? [] : v === true ? k : `${k} as ${v}`,
      )
    : many(terms).filter(isNotFalsy);
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
