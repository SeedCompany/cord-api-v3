import type { Comparator } from 'cypher-query-builder/dist/typings/clauses/where-comparators';
import type { Variable } from '../query-augmentation/condition-variables';

export const intersects =
  (value: readonly string[] | Variable, paramName?: string): Comparator =>
  (params, name) => {
    const param = params.addParam(value, paramName ?? name.split('.').at(-1));
    return `size(apoc.coll.intersection(${name}, ${String(param)})) > 0`;
  };
