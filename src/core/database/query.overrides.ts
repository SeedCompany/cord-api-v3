import { Query } from 'cypher-query-builder';
import { Except } from 'type-fest';
import { LogLevel } from '../logger';

/* eslint-disable @typescript-eslint/method-signature-style -- this is enforced
   to treat functions arguments as contravariant instead of bivariant. this
   doesn't matter here as this class won't be overridden. Declaring them as
   methods keeps their color the same as the rest of the query methods. */

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
    call<A extends any[], R extends this | QueryWithResult<any> | void>(
      fn: (query: this, ...args: A) => R,
      ...args: A
    ): R extends void ? this : R;

    /**
     * Defines the result type of the query.
     * Only useful for TypeScript.
     * Must be called directly before run()/first().
     */
    asResult<R>(): QueryWithResult<R>;

    logIt(level?: LogLevel): this;
  }
}

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

Query.prototype.logIt = function logIt(this: Query, level = LogLevel.NOTICE) {
  const orig = this.buildQueryObject.bind(this);
  this.buildQueryObject = function buildQueryObject() {
    const result = orig();
    Object.defineProperty(result.params, 'logIt', {
      value: level,
      configurable: true,
      writable: true,
      enumerable: false,
    });
    return result;
  };

  return this;
};
