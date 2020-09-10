import { Query } from 'cypher-query-builder';
import { Order, SortablePaginationInput } from '../../../common';

export type Sorter = (query: Query, sort: string, order: Order) => Query | void;

export function calculateTotalAndPaginateList(
  query: Query,
  { page, count, sort: sortInput, order }: SortablePaginationInput,
  sort: Sorter
) {
  query
    .with(['collect(distinct node) as nodes', 'count(distinct node) as total'])
    .raw(`unwind nodes as node`)
    // .with(['node', 'total']) TODO needed?
    .call(sort, sortInput, order)
    .with([
      `collect(distinct node.id)[${(page - 1) * count}..${
        page * count
      }] as items`,
      'total',
    ])
    .return(['items', 'total']);

  return query.asResult<{ items: string[]; total: number }>();
}
