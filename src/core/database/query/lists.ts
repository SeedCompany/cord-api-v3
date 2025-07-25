import { type Query } from 'cypher-query-builder';
import {
  type ID,
  type PaginatedListType,
  type PaginationInput,
} from '~/common';
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
    hydrate?: (query: Query) => Query<{ dto: R }>,
  ) =>
  (query: Query) => {
    let list = 'list';
    const params: Record<string, any> = {
      limit: count,
    };
    if (page !== 1) {
      params.offset = (page - 1) * count;
      list = `list[$offset..]`;
    }

    return query.comment`paginate()`
      .with('collect(distinct node) as list')
      .raw(`WITH list, ${list}[..$limit] as page`, params)
      .subQuery('page', (sub) =>
        sub
          .raw('UNWIND page as node')
          // Capture the order of the node in the list, as we are assuming
          // that's the order we want to maintain from previous sorting().
          .with(['node', 'apoc.coll.indexOf(page, node) as order'])
          .comment('Hydrating node')
          // Hydrate node is sub-query so that hydrate can do whatever it wants
          // as long as it returns `dto`
          .subQuery('node', hydrate ?? ((q) => q.return('node.id as dto')))
          // Re-order rows by the previously determined sorting order.
          // Neo4j doesn't guarantee sort order passed a certain point, and
          // hydration queries can cause neo4j to change it.
          .with('*')
          .orderBy('order')
          // Using collect in sub query ensures that unwinding an empty list
          // and then collecting in the return will maintain the one row outside
          // this sub query so that total and other pagination info is returned.
          .return(collect('dto').as('hydratedPage')),
      )
      .return<PaginatedListType<R>>([
        'hydratedPage as items',
        'size(list) as total',
        // We use list & page here as comparison needs to be done with neo4j nodes
        'size(page) > 0 and page[-1] <> list[-1] as hasMore',
      ]);
  };

export const whereNotDeletedInChangeset = (changeset?: ID) => (query: Query) =>
  changeset
    ? query.raw(
        'WHERE NOT (node)<-[:changeset { active: true, deleting: true }]-(:Changeset { id: $changesetId })',
        { changesetId: changeset },
      )
    : query;
