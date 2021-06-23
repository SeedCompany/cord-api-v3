import { Query } from 'cypher-query-builder';

declare module 'cypher-query-builder/dist/typings/query' {
  interface Query<Result = unknown> {
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
  }
}

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
