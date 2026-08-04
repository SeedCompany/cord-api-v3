import { asc, desc, sql, type SQL, type SQLWrapper } from 'drizzle-orm';
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
 * Collation created in migration 0032. Ignores case, accents, punctuation and
 * spaces when comparing, which is how Neo4j orders names — so lists do not
 * silently reorder as domains move to Postgres.
 *
 * Named explicitly rather than relying on the database default because the
 * default depends on which C library the Postgres image was built against: the
 * alpine image links musl, which has no locale-aware collation and quietly
 * falls back to raw byte order, while a glibc image with the same collation
 * name is locale-aware. See the migration for the full explanation.
 */
const DISPLAY_ORDER_COLLATION = 'display_order';

/**
 * Column types Postgres can collate. Deliberately a whitelist: `uuid` also
 * reports a string data type but cannot be collated, and neither can an enum
 * type — Postgres raises "collations are not supported by type" for both.
 */
const COLLATABLE_COLUMN_TYPES = new Set(['PgText', 'PgVarchar', 'PgChar']);

/**
 * Order a column the way a reader expects, when it holds display text.
 *
 * Text columns get the {@link DISPLAY_ORDER_COLLATION}; everything else is
 * returned untouched, so dates, numbers and ids keep their natural ordering.
 *
 * Columns constrained to a fixed set of values are also left alone. Those hold
 * codes rather than prose — a status or a step — so their ordering should stay
 * exactly as written and not depend on how the collation treats an underscore.
 * (Enum-typed columns additionally cannot be collated at all.)
 *
 * Use this at every text sort, including ones built by hand rather than through
 * {@link resolveOrderBy} — the three list queries that sort by a joined table's
 * name (partner, partnership, project) do exactly that, and would otherwise
 * order differently from every other list in the app.
 */
export const displayOrder = (col: AnyPgColumn): SQLWrapper =>
  COLLATABLE_COLUMN_TYPES.has(col.columnType) && !col.enumValues?.length
    ? sql`${col} collate ${sql.identifier(DISPLAY_ORDER_COLLATION)}`
    : col;

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
  return (Array.isArray(cols) ? cols : [cols]).map((col) =>
    dir(displayOrder(col)),
  );
}
