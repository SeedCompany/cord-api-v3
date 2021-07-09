import { node, Query, relation } from 'cypher-query-builder';
import {
  ID,
  Order,
  PaginatedListType,
  PaginationInput,
  Resource,
  ResourceShape,
  SortablePaginationInput,
} from '../../../common';
import { collect } from './cypher-functions';

/**
 * Adds pagination to a query based on input.
 *
 * Expects a `node` query variable for all available items.
 * Expects filtering and sorting to already be applied.
 *
 * Optionally hydrate each item of the page requested with the hydrate() function.
 * It expects a `dto` output variable.
 * If it's omitted, then by default only the IDs are returned.
 * Note that only `node` is available in this function.
 */
export const paginate =
  <R = ID>(
    { count, page }: PaginationInput,
    hydrate?: (query: Query) => Query<{ dto: R }>
  ) =>
  (query: Query) => {
    let list = 'list';
    const params: Record<string, any> = {
      limit: count,
    };
    if (page !== 1) {
      params.offset = ((page ?? 1) - 1) * count;
      list = `list[$offset..]`;
    }

    return query.comment`paginate()`
      .with('collect(distinct node) as list')
      .raw(`WITH list, ${list}[..$limit] as page`, params)
      .subQuery('page', (sub) =>
        sub
          .raw('UNWIND page as node')
          .comment('Hydrating node')
          .apply(hydrate ?? ((q) => q.with('node.id as dto')))
          // Using collect in sub query ensures that unwinding an empty list
          // and then collecting in the return will maintain the one row outside
          // this sub query so that total and other pagination info is returned.
          .return(collect('dto').as('hydratedPage'))
      )
      .return<PaginatedListType<R>>([
        'hydratedPage as items',
        'size(list) as total',
        // We use list & page here as comparison needs to be done with neo4j nodes
        'size(page) > 0 and page[-1] <> list[-1] as hasMore',
      ]);
  };

/**
 * @deprecated Use {@link paginate} instead.
 */
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
        'WHERE NOT (node)<-[:changeset { active: true, deleting: true }]-(:Changeset { id: $changesetId })',
        { changesetId: changeset }
      )
    : query;
