import { contains, inArray, node, Query, relation } from 'cypher-query-builder';
import { ProjectFilters } from './dto';

export function projectListFilter(query: Query, filter: ProjectFilters) {
  query
    .match([...propMatch('name')])
    .call((q) =>
      filter.name ? q.where({ name: { value: contains(filter.name) } }) : q
    )
    .match([...propMatch('status')])
    .call((q) =>
      filter.status ? q.where({ status: { value: inArray(filter.status) } }) : q
    )
    .match([...propMatch('sensitivity')])
    .call((q) =>
      filter.sensitivity
        ? q.where({ sensitivity: { value: inArray(filter.sensitivity) } })
        : q
    );

  if (filter.clusters) {
    query.match([
      node('node'),
      relation('out', '', 'engagement'),
      node('engagement', { active: true }),
      relation('out', '', 'language'),
      node('language', { active: true }),
    ]);
  }

  if (filter.mine) {
    query.match([
      node('requestingUser'),
      relation('in', '', 'user'),
      node('projectMember', { active: true }),
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
