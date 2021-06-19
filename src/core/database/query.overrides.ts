import { Query } from 'cypher-query-builder';
import { LogLevel } from '../logger';
import './subquery.override';

/* eslint-disable @typescript-eslint/method-signature-style -- this is enforced
   to treat functions arguments as contravariant instead of bivariant. this
   doesn't matter here as this class won't be overridden. Declaring them as
   methods keeps their color the same as the rest of the query methods. */

declare module 'cypher-query-builder/dist/typings/query' {
  // eslint-disable-next-line @seedcompany/no-unused-vars -- false positive, it's required to be the same as the src type signature.
  interface Query<Result = unknown> {
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
    apply<R extends this | Query<any> | void>(
      fn: (query: this) => R
    ): R extends void ? this : R;

    /**
     * Defines the result type of the query.
     *
     * @deprecated Specify result type on {@link return return()} instead.
     */
    asResult<R>(): Query<R>;

    /**
     * Map each row to a different type.
     * Useful to grab a single column.
     *
     * @example
     * const id = query()
     * ...
     * .return<{ id: ID }>('node.id as id')
     * .map('id')
     * .first()
     *
     * @example
     * const id = query()
     * ...
     * .return<{ id: ID }>('node.id as id')
     * .map(row => row.id)
     * .first()
     */
    map<S>(iteratee: (row: Result) => S): Query<S>;
    map<K extends keyof Result>(iteratee: K): Query<Result[K]>;

    logIt(level?: LogLevel): this;
  }
}

Query.prototype.call = function call<
  A extends any[],
  R extends Query<any> | void
>(
  this: Query,
  fn: (q: Query, ...args: A) => R,
  ...args: A
): R extends void ? Query : R {
  return (fn(this, ...args) || this) as Exclude<R, void>;
};

Query.prototype.apply = function apply<R extends Query<any> | void>(
  fn: (q: Query) => R
): R extends void ? Query : R {
  return (fn(this) || this) as Exclude<R, void>;
};

Query.prototype.asResult = function asResult<R>(this: Query) {
  return this as unknown as Query<R>;
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

interface PatchedQuery<R> extends Query<R> {
  mapper?: keyof R | ((row: R) => any);
}

Query.prototype.map = function map(mapper: PatchedQuery<any>['mapper']) {
  (this as PatchedQuery<any>).mapper = mapper;
  return this;
};

// eslint-disable-next-line @typescript-eslint/unbound-method
const origRun = Query.prototype.run;
Query.prototype.run = async function run(...args) {
  const result = await origRun.call(this, ...args);
  const mapper = (this as PatchedQuery<any>).mapper;
  if (!mapper) {
    return result;
  }
  let mapperFn: (row: any) => any;
  if (typeof mapper === 'string') {
    const column = mapper;
    mapperFn = (row: any) => row[column];
  } else {
    mapperFn = mapper as (row: any) => any;
  }
  return result.map((row) => mapperFn.call(undefined, row));
};
