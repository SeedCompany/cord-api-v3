import { node, Query, relation } from 'cypher-query-builder';
import { Order, SortablePaginationInput } from '../../../common';

type SecuredProperties = Record<string, boolean>;

type Sorter = (
  query: Query,
  sortInput: string,
  order: Order,
  securedProperties: SecuredProperties,
  sortValInput?: string
) => Query | void;

export function calculateTotalAndPaginateList(
  query: Query,
  { page, count, sort: sortInput, order }: SortablePaginationInput,
  securedProperties: SecuredProperties,
  sort: Sorter,
  sortValInput?: string
) {
  query
    .with(['collect(distinct node) as nodes', 'count(distinct node) as total'])
    .raw(`unwind nodes as node`)
    // .with(['node', 'total']) TODO needed?
    .call(sort, sortInput, order, securedProperties, sortValInput)
    .with([
      `collect(distinct node.id)[${(page - 1) * count}..${
        page * count
      }] as items`,
      'total',
    ])
    .return(['items', 'total']);

  return query.asResult<{ items: string[]; total: number }>();
}

export const defaultSorter: Sorter = (
  q,
  sortInput,
  order,
  securedProperties,
  sortValInput
) => {
  //The properties that are stored as strings
  const stringProperties = ['name'];
  const sortInputIsString = stringProperties.includes(sortInput);

  //if the sortInput, e.g. name, is a string type, check to see if a custom sortVal is given.  If not, coerse the default prop.value to lower case in the orderBy clause
  const sortValSecuredProp =
    sortValInput || (sortInputIsString ? 'toLower(prop.value)' : 'prop.value');

  const sortValBaseNodeProp = sortInputIsString
    ? `toLower(node.${sortInput})`
    : `node.${sortInput}`;

  return sortInput in securedProperties
    ? q
        .match([
          node('node'),
          relation('out', '', sortInput, { active: true }),
          node('prop', 'Property'),
        ])
        .with('*')
        .orderBy(sortValSecuredProp, order)
    : q.with('*').orderBy(sortValBaseNodeProp, order);
};
