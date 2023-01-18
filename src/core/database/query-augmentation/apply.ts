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
    apply<S>(fn: QueryFragment<Result, S>): Query<S>;
    apply(fn: ((query: this) => void) | null | undefined): this;
  }
}

export type QueryFragment<In = unknown, Out = In> = (
  query: Query<In>
) => Query<Out>;

Query.prototype.apply = function apply<R>(
  fn: ((q: Query) => R) | null | undefined
): R extends void ? Query : R {
  return (fn?.(this) || this) as Exclude<R, void>;
};
