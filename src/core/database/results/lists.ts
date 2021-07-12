import { Query } from 'cypher-query-builder';
import { ID, PaginatedListType, PaginationInput } from '../../../common';
// eslint-disable-next-line @seedcompany/no-unused-vars -- used in jsdoc below.
import { paginate } from '../query';

export const mapListResults = async <T, R>(
  results: PaginatedListType<T>,
  mapper: (item: T) => Promise<R>
) => ({
  ...results,
  items: await Promise.all(results.items.map(mapper)),
});

/**
 * @deprecated Use new {@link paginate} function (optionally with {@link mapListResults})
 */
export async function runListQuery<T>(
  query: Query<{ items: ID[]; total: number }>,
  input: PaginationInput,
  readOne: (id: ID) => Promise<T>
) {
  const result = await query.first();

  // result could be undefined if there are no matched nodes
  // in that case the total truly is 0 we just can't express that in cypher
  if (!result) {
    return {
      items: [],
      total: 0,
      hasMore: false,
    };
  }

  return {
    total: result.total,
    hasMore: hasMore(input, result.total),
    items: await Promise.all(result.items.map(readOne)),
  };
}

export const hasMore = (input: PaginationInput, total: number) =>
  // if skip + count is less than total, there is more
  (input.page - 1) * input.count + input.count < total;
