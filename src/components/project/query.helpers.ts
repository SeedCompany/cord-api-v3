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
    .match([...(filter.status ? propMatch('status') : [[node('node')]])])
    .call((q) =>
      filter.status ? q.where({ status: { value: inArray(filter.status) } }) : q
    )
    .match([
      ...(filter.sensitivity ? propMatch('sensitivity') : [[node('node')]]),
    ])
    .call((q) =>
      filter.sensitivity
        ? q.where({ sensitivity: { value: inArray(filter.sensitivity) } })
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
}

function propMatch(property: string) {
  return [
    [
      node('node'),
      relation('out', '', property, { active: true }),
      node(property, 'Property'),
    ],
  ];
}
