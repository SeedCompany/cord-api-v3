import { asc, desc, SQL, sql, type SQLWrapper } from 'drizzle-orm';
import { type AnyPgColumn } from 'drizzle-orm/pg-core';
import { type Order } from '~/common';
import {
  educations,
  fieldRegions,
  fieldZones,
  fileNodes,
  fundingAccounts,
  languages,
  locations,
  organizations,
  producibles,
  projects,
  tools,
  users,
} from './schema';

/**
 * One thing to order by: a column, or an expression built with {@link sql}.
 *
 * An expression is needed when Neo4j's matching sorter does not order by a
 * single stored value — `User.fullName` is the case that forced this: Neo4j
 * concatenates first and last name into ONE string and orders that, which is not
 * the same as ordering by first name then last name (see the user repository).
 *
 * ⚠️ An expression is returned from {@link displayOrder} UNCOLLATED, because
 * there is no column to look up in {@link NAME_COLUMNS}. Build name expressions
 * with {@link collateDisplayOrder} so the collation cannot be forgotten.
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
 * The columns that hold a display NAME, and so are the only ones collated.
 *
 * This has to be a list, because the thing being matched is not a property of
 * the column. Neo4j does not fold text because it is text — its own string
 * ordering is raw code points, where capitals sort before lower case and spaces
 * count. The folding comes from `@NameField`, which attaches a sort transformer
 * running `apoc.text.clean`, and `sorting()` applies that only where the
 * transformer exists. So "does Neo4j fold this column" means "is its DTO field
 * `@NameField`" — nothing about the column's type can answer it.
 *
 * Inferring from the type instead is what this replaces, and it silently folded
 * nine columns Neo4j leaves alone: two address fields, a post body, two product
 * descriptions, an ISO code, a PMC entity code, a department id and an
 * unavailability description. Those are exactly the sorts that would have
 * reordered under a reader at the flip.
 *
 * Entries are the columns behind `@NameField` DTO fields. Add a column here when
 * you add a sort key whose DTO field is `@NameField`; leave it out otherwise. The
 * default — not collated — matches Neo4j for every plain `@Field()`, so the cost
 * of forgetting is one list ordering by code point rather than a divergence
 * everywhere.
 *
 * migration-todo: at Phase 7 cutover this whole question can be revisited on its
 * merits rather than as parity. Folding case and punctuation is arguably better
 * for an address or a description than code-point order; it is simply not what
 * Neo4j does today, and the migration is not the place to change what users see.
 */
const NAME_COLUMNS: ReadonlySet<AnyPgColumn> = new Set<AnyPgColumn>([
  fieldRegions.name,
  fieldZones.name,
  fundingAccounts.name,
  languages.name,
  languages.displayName,
  locations.name,
  organizations.name,
  organizations.acronym,
  producibles.name,
  projects.name,
  tools.name,
  users.realFirstName,
  users.realLastName,
  users.displayFirstName,
  users.displayLastName,
  educations.major,
  educations.institution,
  // Also the DEFAULT sort of FileListInput, so this covers every unsorted
  // file and directory listing, not just an explicit sort request.
  fileNodes.name,
]);

/**
 * Order a column the way a reader expects.
 *
 * A column listed in {@link NAME_COLUMNS} gets the
 * {@link DISPLAY_ORDER_COLLATION}, because that is the set Neo4j folds.
 * Everything else — dates, numbers, enums, ids, and plain text like an address or
 * a description — is returned untouched, which is also what Neo4j does with it.
 *
 * The type checks that remain are a safety net rather than the decision: a
 * non-text column cannot be collated at all (Postgres raises "collations are not
 * supported by type" for enum and uuid), so a wrong entry in the list fails loudly
 * instead of producing broken SQL at run time. Primary keys are excluded for the
 * same belt-and-braces reason — every id column here is `text`, and collating an
 * id would both reorder a list by an opaque generated value and stop the ordering
 * being read off the primary key index, for any list that falls back to id sorting.
 *
 * ⚠️ This can only inspect a COLUMN. A sort written as a raw `sql` expression has
 * no column to look up, so it is returned unchanged — with no error and nothing
 * failing. That pass-through is deliberate rather than accidental: an expression
 * is the only way to express a sort Neo4j builds from more than one stored value,
 * and only its author knows whether the result is a name. Build those with
 * {@link collateDisplayOrder} rather than by hand, so the collation travels with
 * the expression instead of being something to remember.
 *
 * Use this at every name sort, including ones built by hand rather than through
 * {@link resolveOrderBy} — the three list queries that sort by a joined table's
 * name (partner, partnership, project) do exactly that, and would otherwise order
 * differently from every other list in the app.
 */
export const displayOrder = (col: SortEntry): SQLWrapper =>
  // An expression rather than a column — a value computed in the query, such
  // as a partner's sensitivity derived from its projects, or a name built
  // from more than one column. There is no column to look up in NAME_COLUMNS,
  // so it orders as-is; name expressions arrive pre-collated via
  // {@link collateDisplayOrder}.
  col instanceof SQL
    ? col
    : NAME_COLUMNS.has(col) &&
        COLLATABLE_COLUMN_TYPES.has(col.columnType) &&
        !col.enumValues?.length &&
        !col.primary
      ? sql`${col} collate ${sql.identifier(DISPLAY_ORDER_COLLATION)}`
      : col;

/**
 * Collate a multi-column name EXPRESSION the way {@link displayOrder} collates a
 * name column, so both order the same way.
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
 * Whether {@link displayOrder} would fold this column's case and punctuation.
 *
 * For repositories that sort THROUGH a relation: reaching another table's
 * column means wrapping it in a correlated subquery, and `displayOrder` cannot
 * look inside an expression — so a name would come back unfolded, ordering
 * differently from the same name sorted directly. Ask this, and wrap with
 * {@link collateDisplayOrder} when it answers true, rather than each
 * repository keeping its own copy of the name list.
 *
 * ⚠ A delegated sort folds according to the TARGET field, which is not always
 * the same answer as the key suggests. Neo4j looks its transformer up as
 * (resource, field), so Engagement's `project.name` folds (it resolves to
 * Project's `@NameField` name) while Ceremony's `projectName` does NOT (there
 * is no such field on Ceremony to carry a transformer). Use this for the
 * former; write the latter uncollated on purpose.
 */
export const foldsAsName = (col: SortEntry): boolean =>
  !(col instanceof SQL) &&
  NAME_COLUMNS.has(col) &&
  COLLATABLE_COLUMN_TYPES.has(col.columnType) &&
  !col.enumValues?.length &&
  !col.primary;

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
