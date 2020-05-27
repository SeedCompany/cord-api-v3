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
    call: <A extends any[]>(
      fn: (query: this, ...args: A) => this | void,
      ...args: A
    ) => this;
  }
}

// eslint-disable-next-line @typescript-eslint/unbound-method
Query.prototype.call = function call<A extends any[]>(
  this: Query,
  fn: (q: Query, ...args: A) => Query | void,
  ...args: A
): Query {
  return fn(this, ...args) || this;
};
