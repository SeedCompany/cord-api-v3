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

  if (filter.step) {
    query
      .match(propMatch('step'))
      .where({ step: { value: inArray(filter.step) } });
  }

  if (filter.createdAt) {
    if (filter.createdAt.before && filter.createdAt.after) {
      query.raw(
        `MATCH (node) WHERE node.createdAt <= datetime($date1) AND  noe.createdAt >= datetime($date2)`,
        { date1: filter.createdAt.after, date2: filter.createdAt.before }
      );
    } else if (filter.createdAt.after) {
      query.raw('MATCH (node) WHERE node.createdAt >= datetime($date)', {
        date: filter.createdAt.after,
      });
    } else if (filter.createdAt.before) {
      query.raw('MATCH (node) WHERE node.createdAt <= datetime($date)', {
        date: filter.createdAt.before,
      });
    }
  }

  if (filter.modifiedAt) {
    if (filter.modifiedAt.after && filter.modifiedAt.before) {
      query.raw(
        `MATCH (node)-[r:modifiedAt]-(modifiedAt:Property)
         WHERE modifiedAt.value >= datetime($date1) AND modifiedAt.value <=  datetime($date2)`,
        { date1: filter.modifiedAt.after, date2: filter.modifiedAt.before }
      );
    } else if (filter.modifiedAt.after) {
      query.raw(
        'MATCH (node)-[r:modifiedAt]-(modifiedAt:Property) WHERE modifiedAt.value >= datetime($date)',
        { date: filter.modifiedAt.after }
      );
    } else if (filter.modifiedAt.before) {
      query.raw(
        'MATCH (node)-[r:modifiedAt]-(modifiedAt:Property) WHERE modifiedAt.value <= datetime($date)',
        { date: filter.modifiedAt.before }
      );
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
