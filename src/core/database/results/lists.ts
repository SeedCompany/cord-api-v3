import { PaginationInput } from '../../../common';
import { QueryWithResult } from '../query.overrides';

export async function runListQuery<T>(
  query: QueryWithResult<{ items: string[]; total: number }>,
  input: PaginationInput,
  readOne: (id: string) => Promise<T>
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
