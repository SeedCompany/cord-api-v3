import { Query } from 'cypher-query-builder';

declare module 'cypher-query-builder/dist/typings/query' {
  interface Query {
    /**
     * Apply custom query modifications while maintaining the fluent chain.
     *
     * ```
     * await this.db.query()
     *   .raw(`
     *     ...
     *   `)
     *   .call(q => {
     *     if (addTheThing) {
     *       q.raw('...');
     *     }
     *   })
     *   .first();
     * ```
     */
    call: (fn: (query: this) => this | void) => this;
  }
}

// eslint-disable-next-line @typescript-eslint/unbound-method
Query.prototype.call = function call(
  this: Query,
  fn: (q: Query) => Query | void
): Query {
  return fn(this) || this;
};
