import { Query } from 'cypher-query-builder';

declare module 'cypher-query-builder/dist/typings/query' {
  interface Query {
    /**
     * Apply custom query modifications while maintaining the fluent chain.
     *
     * @deprecated Use {@link apply}() instead.
     *
     * In the future this could be changed to utilize native neo4j call logic.
     */
    call<A extends any[], R extends this | Query<any> | void>(
      fn: (query: this, ...args: A) => R,
      ...args: A
    ): R extends void ? this : R;
  }
}

Query.prototype.call = function call<
  A extends any[],
  R extends Query<any> | void,
>(
  this: Query,
  fn: (q: Query, ...args: A) => R,
  ...args: A
): R extends void ? Query : R {
  return (fn(this, ...args) || this) as Exclude<R, void>;
};
