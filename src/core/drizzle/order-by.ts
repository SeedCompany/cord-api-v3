import { asc, desc, type SQL } from 'drizzle-orm';
import { type AnyPgColumn } from 'drizzle-orm/pg-core';
import { type Order } from '~/common';

/**
 * One sort entry: a single column, or a column list expressing tiebreakers
 * (e.g. `[lastName, firstName]`).
 */
export type SortColumns = AnyPgColumn | readonly AnyPgColumn[];

/**
 * Map of supported sort keys to columns, narrowed to the DTO's fields:
 * `satisfies SortMap<keyof Dto>` makes unknown keys fail at compile time.
 */
export type SortMap<TKey extends string> = Partial<Record<TKey, SortColumns>>;

/**
 * Resolve a list-input's `sort` key to an ORDER BY clause. Unmatched keys
 * fall back to `fallback`.
 */
export function resolveOrderBy(
  input: { sort: string; order: Order },
  map: Record<string, SortColumns>,
  fallback: SortColumns,
): SQL[] {
  const dir = input.order === 'ASC' ? asc : desc;
  const cols = map[input.sort] ?? fallback;
  return (Array.isArray(cols) ? cols : [cols]).map(dir);
}
