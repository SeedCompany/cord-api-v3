import {
  between,
  greaterEqualTo,
  greaterThan,
  inArray,
  lessEqualTo,
  node,
  Query,
  relation,
} from 'cypher-query-builder';
import { DateTime } from 'luxon';
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

  if (filter.step) {
    query
      .match(propMatch('step'))
      .where({ step: { value: inArray(filter.step) } });
  }

  if (filter.createdAt) {
    if (filter.createdAt.before && filter.createdAt.after) {
      const after = ISOtoNeo4jDateTime(filter.createdAt.after);
      const before = ISOtoNeo4jDateTime(filter.createdAt.before);
      query
        .match(node('node'))
        .where({ node: { createdAt: between(after, before) } });
    } else if (filter.createdAt.after) {
      const after = ISOtoNeo4jDateTime(filter.createdAt.after);
      query
        .match(node('node'))
        .where({ node: { createdAt: greaterEqualTo(after) } });
    } else if (filter.createdAt.before) {
      const before = ISOtoNeo4jDateTime(filter.createdAt.before);
      query
        .match(node('node'))
        .where({ node: { createdAt: lessEqualTo(before) } });
    }
  }

  if (filter.modifiedAt) {
    if (filter.modifiedAt.after && filter.modifiedAt.before) {
      const after = ISOtoNeo4jDateTime(filter.modifiedAt.after);
      const before = ISOtoNeo4jDateTime(filter.modifiedAt.before);
      query
        .match(propMatch('modifiedAt'))
        .where({ modifiedAt: { value: between(after, before) } });
    } else if (filter.modifiedAt.before) {
      const before = ISOtoNeo4jDateTime(filter.modifiedAt.before);
      query
        .match(propMatch('modifiedAt'))
        .where({ modifiedAt: { value: lessEqualTo(before) } });
    } else if (filter.modifiedAt.after) {
      const after = ISOtoNeo4jDateTime(filter.modifiedAt.after);
      query.match(propMatch('modifiedAt')).where({
        modifiedAt: {
          value: greaterEqualTo(after),
        },
      });
    }
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

const ISOtoNeo4jDateTime = (date: DateTime) => {
  return DateTime.fromISO(date.toString()).toNeo4JDateTime();
};
