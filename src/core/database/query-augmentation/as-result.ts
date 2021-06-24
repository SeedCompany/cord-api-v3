import { Query } from 'cypher-query-builder';

declare module 'cypher-query-builder/dist/typings/query' {
  interface Query {
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
