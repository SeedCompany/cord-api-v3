import {
  between,
  greaterEqualTo,
  greaterThan,
  inArray,
  lessEqualTo,
  node,
  not,
  Query,
  relation,
} from 'cypher-query-builder';
import { AndConditions } from 'cypher-query-builder/src/clauses/where-utils';
import { DateTimeFilter } from '../../common';
import { ACTIVE, matchProjectSens, path } from '../../core/database/query';
import { ProjectFilters } from './dto';

export const projectListFilter = (filter: ProjectFilters) => (query: Query) => {
  const conditions: AndConditions = {};

  if (filter.status) {
    query.match(propMatch('status'));
    conditions.status = { value: inArray(filter.status) };
  }

  if (filter.onlyMultipleEngagements) {
    query
      .match([
        node('node'),
        relation('out', '', 'engagement', ACTIVE),
        node('engagement', 'Engagement'),
      ])
      .with('node, count(engagement) as engagementCount');
    conditions.engagementCount = greaterThan(1);
  }

  if (filter.step) {
    query.match(propMatch('step'));
    conditions.step = { value: inArray(filter.step) };
  }

  if (filter.createdAt) {
    const comparison = comparisonOfDateTimeFilter(filter.createdAt);
    if (comparison) {
      conditions.node = { createdAt: comparison };
    }
  }

  if (filter.modifiedAt) {
    const comparison = comparisonOfDateTimeFilter(filter.modifiedAt);
    if (comparison) {
      query.match(propMatch('modifiedAt'));
      conditions.modifiedAt = { value: comparison };
    }
  }

  if (filter.mine) {
    conditions.mine = path([
      node('requestingUser'),
      relation('in', '', 'user'),
      node('', 'ProjectMember'),
      relation('in', '', 'member'),
      node('node'),
    ]);
  }

  if (filter.pinned != null) {
    const pinned = path([
      node('requestingUser'),
      relation('out', '', 'pinned'),
      node('node'),
    ]);
    conditions.pinned = filter.pinned ? pinned : not(pinned);
  }

  if (filter.presetInventory != null) {
    conditions.presetInventory = path([
      node('node'),
      relation('out', '', 'presetInventory', ACTIVE),
      node('', 'Property', { value: filter.presetInventory }),
    ]);
  }

  if (filter.partnerId != null) {
    conditions.partnerId = path([
      node('node'),
      relation('out', '', 'partnership', ACTIVE),
      node('', 'Partnership'),
      relation('out', '', 'partner', ACTIVE),
      node('', 'Partner', { id: filter.partnerId }),
    ]);
  }

  if (Object.keys(conditions).length > 0) {
    query.where(conditions);
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
