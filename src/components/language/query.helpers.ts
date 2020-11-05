import { inArray, node, Query, relation } from 'cypher-query-builder';
import { LanguageFilters } from './dto';

export function languageListFilter(query: Query, filter: LanguageFilters) {
  query
    .match([
      ...(filter.sensitivity ? propMatch('sensitivity') : [[node('node')]]),
    ])
    .call((q) =>
      filter.sensitivity
        ? q.where({ sensitivity: { value: inArray(filter.sensitivity) } })
        : q
    );
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
