import { node, Query, relation } from 'cypher-query-builder';
import {
  ID,
  Order,
  Resource,
  ResourceShape,
  SortablePaginationInput,
} from '../../../common';

export const calculateTotalAndPaginateList =
  <TResourceStatic extends ResourceShape<any>>(
    resource: TResourceStatic,
    { page, count, sort, order }: SortablePaginationInput,
    sorter?: (q: Query) => Query
  ) =>
  (query: Query) =>
    query
      .with([
        'collect(distinct node) as nodes',
        'count(distinct node) as total',
      ])
      .raw(`unwind nodes as node`)
      // .with(['node', 'total']) TODO needed?
      .apply(sorter ?? defaultSorter(resource, sort, order))
      .with([
        `collect(distinct node.id)[${(page - 1) * count}..${
          page * count
        }] as items`,
        'total',
      ])
      .return<{ items: ID[]; total: number }>(['items', 'total']);

export const defaultSorter =
  <TResourceStatic extends ResourceShape<any>>(
    resource: TResourceStatic,
    sortInput: string,
    order: Order
  ) =>
  (q: Query) => {
    // The properties that are stored as strings
    const stringProperties = ['name', 'displayFirstName', 'displayLastName'];
    const sortInputIsString = stringProperties.includes(sortInput);

    // If the sortInput, e.g. name, is a string type, check to see if a custom sortVal is given.
    // If not, coerce the default prop.value to lower case in the orderBy clause
    const sortValSecuredProp = sortInputIsString
      ? 'toLower(prop.value)'
      : 'prop.value';

    const sortValBaseNodeProp = sortInputIsString
      ? `toLower(node.${sortInput})`
      : `node.${sortInput}`;

    const sortingOnBaseNodeProp = (
      resource.BaseNodeProps ?? Resource.Props
    ).includes(sortInput);

    return !sortingOnBaseNodeProp
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

export const whereNotDeletedInChangeset = (changeset?: ID) => (query: Query) =>
  changeset
    ? query.raw(
        `WHERE NOT (node)<-[:changeset { active: true, deleting: true }]-(:Changeset { id: '${changeset}' })`
      )
    : query;
