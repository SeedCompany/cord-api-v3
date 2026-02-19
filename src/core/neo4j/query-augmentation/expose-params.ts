import { Query } from 'cypher-query-builder';
import type { ParameterContainer } from 'cypher-query-builder/dist/typings/parameter-container';

declare module 'cypher-query-builder/dist/typings/query' {
  interface Query {
    params: ParameterContainer;
  }
}

Object.defineProperty(Query.prototype, 'params', {
  get(this: Query): ParameterContainer {
    return this.clauses;
  },
});
