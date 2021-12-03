import { node, not, Query, relation } from 'cypher-query-builder';
import { AndConditions } from 'cypher-query-builder/src/clauses/where-utils';
import { path } from '../../core/database/query';
import { UserFilters } from './dto';

export const userListFilter = (filter: UserFilters) => (query: Query) => {
  const conditions: AndConditions = {};

  if (filter.pinned != null) {
    const pinned = path([
      node('requestingUser'),
      relation('out', '', 'pinned'),
      node('node'),
    ]);
    conditions.pinned = filter.pinned ? pinned : not(pinned);
  }

  if (Object.keys(conditions).length > 0) {
    query.where(conditions);
  }
};
