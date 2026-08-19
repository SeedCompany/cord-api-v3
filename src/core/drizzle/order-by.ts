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
