import { inArray, Query } from 'cypher-query-builder';
import { AndConditions } from 'cypher-query-builder/src/clauses/where-utils';
import { intersection } from 'lodash';
import { propMatch } from '../project';
import { ApproachToMethodologies, ProductFilters } from './dto';

export const productListFilter = (filter: ProductFilters) => (query: Query) => {
  const conditions: AndConditions = {};

  if (filter.approach || filter.methodology) {
    query.match(propMatch('methodology'));
    conditions.methodology =
      filter.methodology && filter.approach
        ? {
            value: inArray(
              intersection(ApproachToMethodologies[filter.approach], [
                filter.methodology,
              ])
            ),
          }
        : filter.methodology
        ? { value: filter.methodology }
        : { value: inArray(ApproachToMethodologies[filter.approach!]) };
  }

  if (conditions.methodology) {
    query.where(conditions);
  }
};
