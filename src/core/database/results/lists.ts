import { PaginatedListType } from '../../../common';

export const mapListResults = async <T, R>(
  results: PaginatedListType<T>,
  mapper: (item: T) => Promise<R>
) => ({
  ...results,
  items: await Promise.all(results.items.map(mapper)),
});
