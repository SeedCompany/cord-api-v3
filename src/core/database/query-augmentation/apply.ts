import { Query } from 'cypher-query-builder';

declare module 'cypher-query-builder/dist/typings/query' {
  interface Query<Result = unknown> {
    /**
     * Apply custom query modifications while maintaining the fluent chain.
     *
     * Note: Unlike call() this does not have varargs that forward to the given
     * function. This not necessary as helpers can just be written as higher-order
     * functions, see second example. It also made generics on the function
     * impossible to be applied.
     *
     * @example Using an if condition
     * await this.db.query()
     *   .raw(`
     *     ...
     *   `)
     *   .apply(q => {
     *     if (addTheThing) {
     *       q.raw('...');
     *     }
     *   })
     *   .first();
     *
     * @example Abstracting a query fragment with args
     * const matchFoo = (label: string) => (query: Query) =>
     *   query.matchNode('', label, ...)...
     *
     * db.query().apply(matchFoo('Movie'));
     */
    apply<S>(fn: (query: Query<Result>) => Query<S>): Query<S>;
    apply(fn: (query: this) => void): this;
  }
}

Query.prototype.apply = function apply<R>(
  fn: (q: Query) => R
): R extends void ? Query : R {
  return (fn(this) || this) as Exclude<R, void>;
};
