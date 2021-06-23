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

    /**
     * Defines the result type of the query.
     *
     * @deprecated Specify result type on {@link return return()} instead.
     */
    asResult<R>(): Query<R>;
  }
}

Query.prototype.asResult = function asResult<R>(this: Query) {
  return this as unknown as Query<R>;
};
