import { Query } from 'cypher-query-builder';
import { Except } from 'type-fest';

// Work around `Dictionary` return type
export type QueryWithResult<R> = Except<Query, 'run' | 'first'> & {
  run: () => Promise<R[]>;
  first: () => Promise<R | undefined>;
};

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
    call: <A extends any[], R extends this | QueryWithResult<any> | void>(
      fn: (query: this, ...args: A) => R,
      ...args: A
    ) => R extends void ? this : R;

    /**
     * Defines the result type of the query.
     * Only useful for TypeScript.
     * Must be called directly before run()/first().
     */
    asResult: <R>() => QueryWithResult<R>;
  }
}

// eslint-disable-next-line @typescript-eslint/unbound-method
Query.prototype.call = function call<
  A extends any[],
  R extends Query | QueryWithResult<any> | void
>(
  this: Query,
  fn: (q: Query, ...args: A) => R,
  ...args: A
): R extends void ? Query : R {
  return (fn(this, ...args) || this) as Exclude<R, void>;
};

Query.prototype.asResult = function asResult<R>(this: Query) {
  return (this as unknown) as QueryWithResult<R>;
};
