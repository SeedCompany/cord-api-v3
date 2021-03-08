import {
  greaterThan,
  inArray,
  node,
  Query,
  relation,
} from 'cypher-query-builder';
import { ProjectFilters } from './dto';

export function projectListFilter(query: Query, filter: ProjectFilters) {
  query
    .call((q) =>
      filter.status
        ? q
            .match(propMatch('status'))
            .where({ status: { value: inArray(filter.status) } })
        : q
    )
    .call((q) =>
      filter.sensitivity
        ? q
            .match(propMatch('sensitivity'))
            .where({ sensitivity: { value: inArray(filter.sensitivity) } })
        : q
    );

  if (filter.onlyMultipleEngagements) {
    query
      .match([
        node('node'),
        relation('out', '', 'engagement', { active: true }),
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
    // TODO implement filter
  }
}

export const propMatch = (property: string) => [
  node('node'),
  relation('out', '', property, { active: true }),
  node(property, 'Property'),
];
