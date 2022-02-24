import {
  inArray,
  isNull,
  node,
  not,
  Query,
  relation,
} from 'cypher-query-builder';
import { AndConditions } from 'cypher-query-builder/src/clauses/where-utils';
import { identity, intersection } from 'lodash';
import { ACTIVE, path } from '../../core/database/query';
import { propMatch } from '../project';
import { ApproachToMethodologies, ProductFilters } from './dto';

export const productListFilter = (filter: ProductFilters) => (query: Query) => {
  const conditions: AndConditions = {};

  if (filter.engagementId) {
    conditions.engagement = path([
      node('node'),
      relation('in', '', 'product', ACTIVE),
      node('', 'Engagement', {
        id: filter.engagementId,
      }),
    ]);
  }

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

  if (filter.placeholder != null) {
    query.match(propMatch('placeholderDescription'));
    conditions.placeholderDescription = {
      value: (filter.placeholder ? not : identity)(isNull()),
    };
  }

  if (Object.keys(conditions).length > 0) {
    query.where(conditions);
  }
};
