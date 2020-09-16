import { node, relation } from 'cypher-query-builder';
import { Sorter } from './lists';

export enum Sorting {
  Exact = 'Exact',
  CaseInsensitive = 'CaseInsensitive',
}

type SortConfig<SortKey extends string> = { [K in SortKey]?: Sorting };

// A helper to just ease creating the config with the correct type
export const createSortingConfig = <SortKey extends string>(
  sortConfig: SortConfig<SortKey>
) => sortConfig;

export const sortQueryBy = <SortKey extends string, PropKeys extends string>(
  sortConfig: SortConfig<SortKey>,
  securedProperties: Record<PropKeys, boolean>
): Sorter => (q, sortKey, order) => {
  // determine sorting strategy based on sort key
  const sorting = sortConfig[sortKey as SortKey] ?? Sorting.Exact;

  // Choose converting function based on sorting strategy
  const sortingToQueryMap: Record<Sorting, (s: string) => string> = {
    [Sorting.Exact]: (s) => s,
    [Sorting.CaseInsensitive]: (s) => `LOWER(${s})`,
  };
  const handleSorting = sortingToQueryMap[sorting];

  sortKey in securedProperties
    ? q
        .match([
          node('node'),
          relation('out', '', sortKey),
          node('prop', 'Property', { active: true }),
        ])
        .with('*')
        .orderBy(handleSorting('prop.value'), order)
    : q.with('*').orderBy(handleSorting(`node.${sortKey}`), order);
};
