import { node, not, Query, relation } from 'cypher-query-builder';
import { AndConditions } from 'cypher-query-builder/src/clauses/where-utils';
import { Session } from '../../common';
import { matchRequestingUser, path } from '../../core/database/query';
import { UserFilters } from './dto';

export const userListFilter =
  (filter: UserFilters, session: Session) => (query: Query) => {
    const conditions: AndConditions = {};

    if (filter.pinned != null) {
      matchRequestingUser(session)(query);
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
