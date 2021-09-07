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
import { DateTimeFilter } from '../../common';
import { ACTIVE, matchProjectSens } from '../../core/database/query';
import { ProjectFilters } from './dto';

export const projectListFilter = (filter: ProjectFilters) => (query: Query) => {
  if (filter.status) {
    query
      .match(propMatch('status'))
      .where({ status: { value: inArray(filter.status) } });
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
    const comparison = comparisonOfDateTimeFilter(filter.createdAt);
    if (comparison) {
      query.where({ node: { createdAt: comparison } });
    }
  }

  if (filter.modifiedAt) {
    const comparison = comparisonOfDateTimeFilter(filter.modifiedAt);
    if (comparison) {
      query
        .match(propMatch('modifiedAt'))
        .where({ modifiedAt: { value: comparison } });
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

  // last filter due to sub-query needed
  if (filter.sensitivity) {
    query
      .apply(matchProjectSens('node'))
      .with('*')
      .where({ sensitivity: inArray(filter.sensitivity) });
  }
};

export const propMatch = (property: string) => [
  node('node'),
  relation('out', '', property, ACTIVE),
  node(property, 'Property'),
];

const comparisonOfDateTimeFilter = ({ after, before }: DateTimeFilter) =>
  after && before
    ? between(after, before)
    : after
    ? greaterEqualTo(after)
    : before
    ? lessEqualTo(before)
    : undefined;
