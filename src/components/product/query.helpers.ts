import { inArray, Query } from 'cypher-query-builder';
import { propMatch } from '../project';
import { ApproachToMethodologies, ProductFilters } from './dto';

export const productListFilter = (filter: ProductFilters) => (query: Query) => {
  if (filter.methodology) {
    query
      .match(propMatch('methodology'))
      .where({ methodology: { value: filter.methodology } });
  }

  if (filter.approach) {
    query.match(propMatch('methodology')).where({
      methodology: {
        value: inArray(ApproachToMethodologies[filter.approach]),
      },
    });
  }
};
