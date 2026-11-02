import { and, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { type PgColumn, type PgTable, unionAll } from 'drizzle-orm/pg-core';
import { type ID } from '~/common';
import { type LinkToUnknown, type ResourceMap } from '~/core/resources';
import { type DrizzleDb } from './drizzle.service';
import {
  budgetRecords,
  budgets,
  ceremonies,
  comments,
  commentThreads,
  educations,
  engagements,
  engagementTypeEnum,
  fieldRegions,
  fieldZones,
  fileNodes,
  fundingAccounts,
  languages,
  locations,
  notifications,
  organizations,
  partners,
  partnerships,
  periodicReports,
  posts,
  producibles,
  products,
  projectMembers,
  projects,
  projectTypeEnum,
  tools,
  toolUsages,
  unavailabilities,
  users,
} from './schema';

/** A resource row reduced to its id and concrete GraphQL `__typename`. */
interface ResourceRow {
  readonly id: ID;
  readonly typename: string;
}

/**
 * One entry per table that can own a polymorphic resource reference.
 *
 * This registry is the single place that knows (a) which tables a polymorphic id
 * can live in, (b) which concrete `__typename`s each yields, and (c) the liveness
 * rule for each. Adding a resource type to the polymorphic universe is one entry
 * here, and both the id-probe and the discriminator-keyed lookup pick it up.
 *
 * Each entry contributes a SELECT rather than running one. That is what lets the
 * probe below be a single round trip no matter how many tables are registered —
 * see {@link runBranches} for why that matters.
 *
 * A branch MUST filter liveness. A soft-deleted row must not resolve: returning it
 * produces a live-looking reference that the concrete ResourceLoader will then fail
 * to load — surfacing as `NotFoundException` inside a non-null GraphQL field.
 */
interface ResourceTable {
  /** The concrete GraphQL `__typename`s this table can yield. */
  readonly typenames: readonly string[];
  /** Selects `{ id, typename }` for these ids, live rows only. */
  readonly branch: (db: DrizzleDb, ids: readonly ID[]) => ResourceSelect;
}

/**
 * Concrete `__typename`s of the polymorphic subtype families, derived from the DB
 * enums so a newly added subtype registers itself everywhere rather than needing
 * each hand-maintained list to be found and extended.
 */
export const PROJECT_TYPENAMES: readonly string[] =
  projectTypeEnum.enumValues.map((type) => `${type}Project`);
export const ENGAGEMENT_TYPENAMES: readonly string[] =
  engagementTypeEnum.enumValues.map((type) => `${type}Engagement`);

const suffixed = (values: readonly string[], suffix: string) =>
  Object.fromEntries(values.map((value) => [value, `${value}${suffix}`]));

/**
 * Any table whose rows are resources: an id and — unless the domain
 * hard-deletes — a soft-delete marker.
 */
type ResourceTableColumns = PgTable & {
  readonly id: PgColumn;
  readonly deletedAt?: PgColumn;
};

/** One branch of the union: the id and concrete typename, from one table. */
const selectResourceRows = (
  db: DrizzleDb,
  table: ResourceTableColumns,
  typename: SQL<string>,
  where: SQL | undefined,
) => db.select({ id: table.id, typename }).from(table).where(where);

type ResourceSelect = ReturnType<typeof selectResourceRows>;

/** These ids, and only rows still alive. Tables without soft delete skip that. */
const liveWithId = (
  table: ResourceTableColumns,
  ids: readonly ID[],
): SQL | undefined =>
  and(
    inArray(table.id, [...ids]),
    table.deletedAt ? isNull(table.deletedAt) : undefined,
  );

/** A table whose every row is the same concrete type. */
const ofOneType = (
  table: ResourceTableColumns,
  typename: string,
): ResourceTable => ({
  typenames: [typename],
  branch: (db, ids) =>
    selectResourceRows(
      db,
      table,
      sql<string>`${typename}::text`,
      liveWithId(table, ids),
    ),
});

/**
 * A table holding several concrete types, told apart by a stored column.
 *
 * A stored value with no mapping is excluded by the WHERE, so an id of an unmapped
 * subtype behaves like one that does not exist rather than resolving to a wrong
 * type or a NULL typename.
 */
const ofSeveralTypes = (
  table: ResourceTableColumns & { readonly type: PgColumn },
  typenameByStoredValue: Readonly<Record<string, string>>,
): ResourceTable => {
  const stored = Object.keys(typenameByStoredValue);
  // Compared and returned as text so one CASE serves enum and text columns alike,
  // and so every branch's `typename` shares a type across the UNION.
  const concrete = sql<string>`case ${table.type}::text ${sql.join(
    Object.entries(typenameByStoredValue).map(
      ([value, typename]) => sql`when ${value} then ${typename}`,
    ),
    sql` `,
  )} end`;
  return {
    typenames: Object.values(typenameByStoredValue),
    branch: (db, ids) =>
      selectResourceRows(
        db,
        table,
        concrete,
        and(liveWithId(table, ids), inArray(sql`${table.type}::text`, stored)),
      ),
  };
};

/**
 * Every table behind a Resource-implementing type.
 *
 * COVERAGE IS THE POINT. `tools` is declared on the `Resource` interface, and Nest
 * copies an interface field resolver onto every implementing type — 40 of them —
 * so an id this registry cannot place is not a niche case. The field is non-null,
 * so failing to resolve does not produce an empty list: the DataLoader raises a
 * "could not find" error, which nulls the parent object and, inside a list, the
 * whole list. So a new resource table must be added here when it is created.
 *
 * `ProjectChangeRequest` is the sole deliberate omission: changesets are not
 * carried forward, so there is no table to register.
 */
const RESOURCE_TABLES: readonly ResourceTable[] = [
  ofOneType(users, 'User'),
  ofOneType(languages, 'Language'),
  ofOneType(partners, 'Partner'),
  ofSeveralTypes(projects, suffixed(projectTypeEnum.enumValues, 'Project')),
  ofSeveralTypes(
    engagements,
    suffixed(engagementTypeEnum.enumValues, 'Engagement'),
  ),
  // Reports of all three kinds share one table. Soft-deleted as of migration 0035,
  // which `liveWithId` picks up from the column's presence.
  ofSeveralTypes(periodicReports, {
    Progress: 'ProgressReport',
    Financial: 'FinancialReport',
    Narrative: 'NarrativeReport',
  }),
  ofSeveralTypes(products, {
    DirectScripture: 'DirectScriptureProduct',
    Derivative: 'DerivativeScriptureProduct',
    Other: 'OtherProduct',
  }),
  ofSeveralTypes(fileNodes, {
    Directory: 'Directory',
    File: 'File',
    FileVersion: 'FileVersion',
  }),
  ofSeveralTypes(producibles, {
    Film: 'Film',
    Story: 'Story',
    EthnoArt: 'EthnoArt',
  }),
  // notifications does not soft-delete, so no liveness filter applies.
  ofSeveralTypes(notifications, {
    System: 'SystemNotification',
    CommentViaMention: 'CommentViaMentionNotification',
  }),

  ofOneType(organizations, 'Organization'),
  ofOneType(locations, 'Location'),
  ofOneType(fieldRegions, 'FieldRegion'),
  ofOneType(fieldZones, 'FieldZone'),
  ofOneType(fundingAccounts, 'FundingAccount'),
  ofOneType(partnerships, 'Partnership'),
  ofOneType(budgets, 'Budget'),
  ofOneType(budgetRecords, 'BudgetRecord'),
  ofOneType(ceremonies, 'Ceremony'),
  ofOneType(projectMembers, 'ProjectMember'),
  ofOneType(unavailabilities, 'Unavailability'),
  ofOneType(educations, 'Education'),
  ofOneType(tools, 'Tool'),
  ofOneType(toolUsages, 'ToolUsage'),
  // comments, comment_threads and posts hard-delete — again handled by the absence
  // of the column rather than stated per table.
  ofOneType(comments, 'Comment'),
  ofOneType(commentThreads, 'CommentThread'),
  ofOneType(posts, 'Post'),
];

const TABLE_BY_TYPENAME: ReadonlyMap<string, ResourceTable> = new Map(
  RESOURCE_TABLES.flatMap((table) =>
    table.typenames.map((typename) => [typename, table] as const),
  ),
);

// The typename comes from the registry above, so it names a registered resource.
const toRef = (row: ResourceRow): LinkToUnknown => ({
  __typename: row.typename as keyof ResourceMap,
  id: row.id,
});

/**
 * Run the given branches as ONE `UNION ALL` and shape the rows.
 *
 * One statement, not one per table, and this is load-bearing rather than tidiness.
 * Running the branches concurrently instead exhausted the database's connection
 * limit — `sorry, too many clients already`, surfacing as unrelated queries failing
 * elsewhere in the same request. A registry of ~25 tables issuing ~25 concurrent
 * connections per batch does that under any real load, and widening the pool only
 * moves where it breaks. Each branch is an indexed primary-key lookup, so the
 * server does the same work either way; the difference is one connection instead
 * of one per table.
 */
const runBranches = async (
  branches: readonly ResourceSelect[],
): Promise<ResourceRow[]> => {
  const [first, second, ...rest] = branches;
  if (!first) return [];
  // `unionAll` needs two or more; one branch is already a complete query.
  const rows = !second ? await first : await unionAll(first, second, ...rest);
  return rows.map((row) => ({ id: row.id as ID, typename: row.typename }));
};

/**
 * Resolve an arbitrary resource id to a `{ __typename, id }` reference by probing
 * every table in the registry. Polymorphic domains (Comments, Post, ToolUsage)
 * hand the service this reference so `ResourceLoader.loadByRef` can load the full
 * DTO.
 *
 * Use this only when the caller has an id and no discriminator. When a stored
 * `*_type` column is available, prefer {@link resolveResourceRefsByType} — it
 * reads fewer tables and can distinguish "deleted" from "unsupported type".
 */
export const resolveResourceRef = async (
  db: DrizzleDb,
  id: ID,
): Promise<LinkToUnknown | undefined> => {
  const rows = await runBranches(
    RESOURCE_TABLES.map((table) => table.branch(db, [id])),
  );
  return rows[0] ? toRef(rows[0]) : undefined;
};

/**
 * Batched id → reference probe: one statement regardless of how many ids or how
 * many tables are registered.
 */
export const resolveResourceRefs = async (
  db: DrizzleDb,
  ids: readonly ID[],
): Promise<ReadonlyMap<ID, LinkToUnknown>> => {
  const unique = [...new Set(ids)];
  const refs = new Map<ID, LinkToUnknown>();
  if (unique.length === 0) return refs;
  const rows = await runBranches(
    RESOURCE_TABLES.map((table) => table.branch(db, unique)),
  );
  for (const row of rows) refs.set(row.id, toRef(row));
  return refs;
};

export interface ResolvedResourceRefs {
  /**
   * The live reference per id. An id whose row is missing or soft-deleted is
   * ABSENT, and callers must drop it.
   */
  readonly refs: ReadonlyMap<ID, LinkToUnknown>;
  /**
   * `__typename`s no registry entry claims. This is a COVERAGE GAP, not a
   * deletion, and callers must surface it — silently dropping these makes a
   * newly-added resource type look exactly like one that was deleted.
   */
  readonly unknownTypes: ReadonlySet<string>;
}

/**
 * Resolve ids to references using a stored discriminator, so only the tables
 * actually referenced are read — typically one or two per page rather than the
 * whole registry.
 *
 * The discriminator also lets a caller tell the two failure modes apart, which an
 * id-only probe cannot: a known type that resolved to nothing is a deleted
 * resource (drop it), while an unclaimed type means the registry is behind the
 * schema (a bug worth logging).
 */
export const resolveResourceRefsByType = async (
  db: DrizzleDb,
  refs: ReadonlyArray<{ id: ID; type: string }>,
): Promise<ResolvedResourceRefs> => {
  const idsByTable = new Map<ResourceTable, Set<ID>>();
  const unknownTypes = new Set<string>();
  for (const ref of refs) {
    const table = TABLE_BY_TYPENAME.get(ref.type);
    if (!table) {
      unknownTypes.add(ref.type);
      continue;
    }
    const ids = idsByTable.get(table) ?? new Set<ID>();
    ids.add(ref.id);
    idsByTable.set(table, ids);
  }
  const rows = await runBranches(
    [...idsByTable].map(([table, ids]) => table.branch(db, [...ids])),
  );
  const resolved = new Map<ID, LinkToUnknown>();
  for (const row of rows) resolved.set(row.id, toRef(row));
  return { refs: resolved, unknownTypes };
};
