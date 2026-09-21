import { asc, desc, SQL, sql, type SQLWrapper } from 'drizzle-orm';
import { type AnyPgColumn } from 'drizzle-orm/pg-core';
import { type Order } from '~/common';

/**
 * One thing to order by: a column, or an expression built with {@link sql}.
 *
 * An expression is needed when Neo4j's matching sorter does not order by a
 * single stored value — `User.fullName` is the case that forced this: Neo4j
 * concatenates first and last name into ONE string and orders that, which is not
 * the same as ordering by first name then last name (see the user repository).
 *
 * ⚠️ An expression is returned from {@link displayOrder} UNCOLLATED, because
 * only a column carries the type information the fold decision reads. Build
 * text expressions with {@link collateDisplayOrder} so the collation cannot be
 * forgotten.
 */
export type SortEntry = AnyPgColumn | SQL;

/**
 * One sort entry: a single column or expression, or a list expressing
 * tiebreakers (e.g. `[lastName, firstName]`).
 */
export type SortColumns = SortEntry | readonly SortEntry[];

/**
 * Map of supported sort keys to columns, narrowed to the DTO's fields:
 * `satisfies SortMap<keyof Dto>` makes unknown keys fail at compile time.
 */
export type SortMap<TKey extends string> = Partial<Record<TKey, SortColumns>>;

/**
 * Collation created in migration 0032. Ignores case, accents, punctuation and
 * spaces when comparing, so `apple` and `Apple` sort together.
 *
 * Applied to EVERY text sort (decided 2026-09-15): case-insensitive sorting is
 * a product rule, not a per-column one. Neo4j folds only names this way
 * (`@NameField` attaches an `apoc.text.clean` sort transformer) and orders
 * every other text field by raw code points, so the non-name text sorts are a
 * DELIBERATE divergence from Neo4j — chosen because capitals-before-lowercase
 * was never behavior anyone wanted, merely what Neo4j did, and reordering under
 * live readers is free only while Postgres has none.
 *
 * Named explicitly rather than relying on the database default because the
 * default depends on which C library the Postgres image was built against: the
 * alpine image links musl, which has no locale-aware collation and quietly
 * falls back to raw byte order, while a glibc image with the same collation
 * name is locale-aware. An ICU collation orders identically on both, so CI
 * (alpine) and production (Amazon RDS, glibc) agree. See the migration for the
 * full explanation.
 */
const DISPLAY_ORDER_COLLATION = 'display_order';

/**
 * Column types Postgres can collate. Deliberately a whitelist: `uuid` also
 * reports a string data type but cannot be collated, and neither can an enum
 * type — Postgres raises "collations are not supported by type" for both.
 */
const COLLATABLE_COLUMN_TYPES = new Set(['PgText', 'PgVarchar', 'PgChar']);

/**
 * Whether {@link displayOrder} folds this column when sorting: any collatable
 * text column that is not a primary key.
 *
 * Primary keys are excluded because every id column here is `text`, and
 * collating an id would both reorder a list by an opaque generated value and
 * stop the ordering being read off the primary key index, for any list that
 * falls back to id sorting. The remaining checks exclude what Postgres cannot
 * collate at all — it raises "collations are not supported by type" for enum
 * and uuid.
 *
 * For repositories that sort THROUGH a relation: reaching another table's
 * column means wrapping it in a correlated subquery, and {@link displayOrder}
 * cannot look inside an expression — so the text would come back unfolded,
 * ordering differently from the same value sorted directly. Ask this about the
 * TARGET column, and wrap the subquery with {@link collateDisplayOrder} when it
 * answers true.
 */
export const foldsWhenSorted = (col: SortEntry): boolean =>
  !(col instanceof SQL) &&
  COLLATABLE_COLUMN_TYPES.has(col.columnType) &&
  !col.enumValues?.length &&
  !col.primary;

/**
 * Order a column the way a reader expects: text folds case, accents and
 * punctuation via the {@link DISPLAY_ORDER_COLLATION}; everything else —
 * dates, numbers, enums, ids — is returned untouched.
 *
 * ⚠️ This can only inspect a COLUMN. A sort written as a raw `sql` expression
 * has no column to inspect, so it is returned unchanged — with no error and
 * nothing failing. That pass-through is deliberate rather than accidental: an
 * expression is the only way to express a sort built from more than one stored
 * value or read through a relation, and only its author knows whether the
 * result is text. Build multi-column text expressions with
 * {@link collateDisplayOrder} and delegated single-column reads via
 * {@link foldsWhenSorted}, so the collation travels with the expression instead
 * of being something to remember.
 *
 * Use this at every text sort, including ones built by hand rather than through
 * {@link resolveOrderBy} — the three list queries that sort by a joined table's
 * name (partner, partnership, project) do exactly that, and would otherwise
 * order differently from every other list in the app.
 */
export const displayOrder = (col: SortEntry): SQLWrapper =>
  // An expression rather than a column — a value computed in the query, such
  // as a partner's sensitivity derived from its projects, or a name built
  // from more than one column. There is no column to inspect, so it orders
  // as-is; text expressions arrive pre-collated via
  // {@link collateDisplayOrder}.
  col instanceof SQL
    ? col
    : foldsWhenSorted(col)
      ? sql`${col} collate ${sql.identifier(DISPLAY_ORDER_COLLATION)}`
      : col;

/**
 * Collate a text EXPRESSION the way {@link displayOrder} collates a text
 * column, so both order the same way.
 *
 * Postgres applies a collation to the result of the whole expression, so this
 * wraps rather than collating each part — `(a || b) collate display_order`, not
 * `(a collate display_order) || b`, which would not compile.
 */
export const collateDisplayOrder = (expr: SQL): SQL =>
  sql`(${expr}) collate ${sql.identifier(DISPLAY_ORDER_COLLATION)}`;

/**
 * Order ONE entry the way Neo4j orders it: blanks last, whichever direction was
 * asked for.
 *
 * Postgres puts nulls last on ASC but FIRST on DESC, and Neo4j puts them last
 * both ways — `sortWith` orders by `[sortValue IS NOT NULL, sortValue]` on DESC
 * for exactly this reason (`src/core/neo4j/query/sorting.ts`). So every list
 * sorted DESC on a nullable key disagreed between the engines, with the blank
 * rows moving from the end of the list to the front of it.
 *
 * Measured 2026-09-10 on `Language.registryOfLanguageVarietiesCode` (a nullable
 * column both engines really sort), three fixtures where one code is blank:
 *   ASC  — identical, blank last on both
 *   DESC — Neo4j `22222 | 11111 | blank`, Postgres `blank | 22222 | 11111`
 *
 * `nulls last` on ASC too is a deliberate no-op: it already matches Postgres's
 * default, and writing it makes the rule one thing rather than two.
 *
 * ⚠ Use this for every USER-CHOSEN sort key, including the hand-rolled
 * cross-domain ones that call `asc`/`desc` directly. A fixed internal order on
 * a NOT NULL column (`createdAt`, an id tiebreaker) has no nulls to place and
 * does not need it.
 */
export const orderEntry = (col: SortEntry, order: Order): SQL => {
  const dir = order === 'ASC' ? asc : desc;
  return sql`${dir(displayOrder(col))} nulls last`;
};

/** {@link orderEntry} over a whole sort entry, tiebreakers included. */
export const orderEntries = (cols: SortColumns, order: Order): SQL[] =>
  (Array.isArray(cols) ? cols : [cols]).map((col) => orderEntry(col, order));

/**
 * Look a sort key up in a map of them, ignoring anything inherited.
 *
 * ⚠ Use this for EVERY lookup keyed by the client's `sort` string. That string
 * is a plain GraphQL `String` validated only against `/^[A-Za-z0-9_.]+$/`
 * (`SortablePaginationInput`), so `constructor`, `toString` and `valueOf` all
 * arrive as ordinary requests — and a plain-object lookup answers them with an
 * inherited function rather than undefined. That function then reads as a
 * supported key: it survives a truthiness guard and a `key in map` test alike,
 * and Drizzle binds it as a query PARAMETER, so the list comes back unsorted or
 * the query errors outright. `Object.hasOwn` is what makes an unknown key
 * unknown.
 */
export const sortColumnFor = <T>(
  map: Record<string, T>,
  key: string,
): T | undefined => (Object.hasOwn(map, key) ? map[key] : undefined);

/**
 * Resolve a list-input's `sort` key to an ORDER BY clause. Unmatched keys
 * fall back to `fallback`.
 *
 * ⚠️ The fallback is NOT quiet. The direction still applies, so an unsupported
 * key orders the list by `fallback` in the requested direction and re-flips it
 * on the next click — which reads as a sort that works badly rather than a key
 * that is not wired. Sorting projects by `engagements.total` looked exactly like
 * this before it was implemented. Prefer rejecting unknown keys (see the Project
 * and Partner repositories) over relying on this.
 */
export function resolveOrderBy(
  input: { sort: string; order: Order },
  map: Record<string, SortColumns>,
  fallback: SortColumns,
): SQL[] {
  return orderEntries(sortColumnFor(map, input.sort) ?? fallback, input.order);
}
