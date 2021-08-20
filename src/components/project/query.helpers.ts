import {
  greaterThan,
  inArray,
  node,
  Query,
  relation,
} from 'cypher-query-builder';
import { ACTIVE } from '../../core/database/query';
import { ProjectFilters } from './dto';

export const projectListFilter = (filter: ProjectFilters) => (query: Query) => {
  if (filter.status) {
    query
      .match(propMatch('status'))
      .where({ status: { value: inArray(filter.status) } });
  }
  if (filter.sensitivity) {
    query
      .match(propMatch('sensitivity'))
      .where({ sensitivity: { value: inArray(filter.sensitivity) } });
  }
  if (filter.onlyMultipleEngagements) {
    query
      .match([
        node('node'),
        relation('out', '', 'engagement', ACTIVE),
        node('engagement', 'Engagement'),
      ])
      .with('node, count(engagement) as engagementCount')
      .where({ engagementCount: greaterThan(1) });
  }

  if (filter.mine) {
    query.match([
      node('requestingUser'),
      relation('in', '', 'user'),
      node('projectMember'),
      relation('in', '', 'member'),
      node('node'),
    ]);
  }

  if (filter.pinned != null) {
    if (filter.pinned) {
      query.match([
        node('requestingUser'),
        relation('out', '', 'pinned'),
        node('node'),
      ]);
    } else {
      query.raw('where not (requestingUser)-[:pinned]->(node)');
    }
  }
};

export const propMatch = (property: string) => [
  node('node'),
  relation('out', '', property, ACTIVE),
  node(property, 'Property'),
];
