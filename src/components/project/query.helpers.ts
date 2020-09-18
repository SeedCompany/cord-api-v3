import { inArray, node, Query, relation } from 'cypher-query-builder';
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

  if (filter.clusters) {
    query.match([
      node('node'),
      relation('out', '', 'engagement'),
      node('engagement'),
      relation('out', '', 'language'),
      node('language'),
    ]);
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
      node(property, 'Property', { active: true }),
    ],
  ];
}
