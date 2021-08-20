import { PaginatedListType, PaginationInput } from '../../../common';

export const mapListResults = async <T, R>(
  results: PaginatedListType<T>,
  mapper: (item: T) => Promise<R>
) => ({
  ...results,
  items: await Promise.all(results.items.map(mapper)),
});

export const hasMore = (input: PaginationInput, total: number) =>
  // if skip + count is less than total, there is more
  (input.page - 1) * input.count + input.count < total;
