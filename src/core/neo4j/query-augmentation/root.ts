import { Query } from 'cypher-query-builder';

declare module 'cypher-query-builder/dist/typings/query' {
  interface Query {
    get root(): Query;
  }
}

const Parent = Symbol('ParentQuery');

type PrivateQuery = Query & { [Parent]?: Query };

Object.defineProperty(Query.prototype, 'root', {
  get(): Query {
    let maybeRoot = this as PrivateQuery;
    while (maybeRoot[Parent]) {
      maybeRoot = maybeRoot[Parent];
    }
    return maybeRoot;
  },
  enumerable: false,
  configurable: false,
});

export const withParent = (query: Query, parent: Query) => {
  (query as PrivateQuery)[Parent] = parent;
  return query;
};
