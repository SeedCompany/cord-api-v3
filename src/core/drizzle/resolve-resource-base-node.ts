import { and, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { type PgColumn, type PgTable, unionAll } from 'drizzle-orm/pg-core';
import { DateTime } from 'luxon';
import { type ID } from '~/common';
import { type BaseNode } from '~/core/neo4j/results';
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

/**
 * A resource row reduced to what a {@link BaseNode} needs.
 * `labels` is concrete-typename-first, without the trailing `BaseNode`.
 */
interface ResourceRow {
  readonly id: ID;
  readonly createdAt: Date;
  readonly labels: readonly string[];
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
 * see {@link resolveResourceBaseNodes} for why that matters.
 *
 * A branch MUST filter liveness. A soft-deleted row must not resolve: Neo4j's soft
 * delete strips every label including `BaseNode`, so the Cypher's
 * `node(container, 'BaseNode')` match drops it. Returning it here instead produces
 * a live-looking node that the concrete ResourceLoader will then fail to load —
 * surfacing as `NotFoundException` inside a non-null GraphQL field.
 */
interface ResourceTable {
  /** The concrete GraphQL `__typename`s this table can yield. */
  readonly typenames: readonly string[];
  /** Selects `{ id, createdAt, labels }` for these ids, live rows only. */
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
 * Any table whose rows are resources: an id, a creation time, and — unless the
 * domain hard-deletes — a soft-delete marker.
 */
type ResourceTableColumns = PgTable & {
  readonly id: PgColumn;
  readonly createdAt: PgColumn;
  readonly deletedAt?: PgColumn;
};

/**
 * One branch of the union: the three things a BaseNode needs, from one table.
 *
 * Built through the query builder rather than as raw text so the driver's own
 * type parsing applies — the timestamp arrives as a `Date` and the label array as
 * an array, instead of whatever a hand-written statement's rows happen to hold.
 */
const selectResourceRows = (
  db: DrizzleDb,
  table: ResourceTableColumns,
  labels: SQL<string[]>,
  where: SQL | undefined,
) =>
  db
    .select({ id: table.id, createdAt: table.createdAt, labels })
    .from(table)
    .where(where);

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
      sql`array[${typename}]::text[]`,
      liveWithId(table, ids),
    ),
});

/**
 * A table holding several concrete types, told apart by a stored column.
 *
 * `extraLabel` appends a family label, so a project row carries both
 * `TranslationProject` and `Project` exactly as it did when each family had its
 * own hand-written entry.
 *
 * A stored value with no mapping is excluded by the WHERE, so an id of an unmapped
 * subtype behaves like one that does not exist rather than resolving to a wrong
 * type or a NULL label.
 */
const ofSeveralTypes = (
  table: ResourceTableColumns & { readonly type: PgColumn },
  typenameByStoredValue: Readonly<Record<string, string>>,
  extraLabel?: string,
): ResourceTable => {
  const stored = Object.keys(typenameByStoredValue);
  // Compared and returned as text so one CASE serves enum and text columns alike,
  // and so every branch's `labels` shares a type across the UNION.
  const concrete = sql`case ${table.type}::text ${sql.join(
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
        extraLabel
          ? sql`array[${concrete}, ${extraLabel}]::text[]`
          : sql`array[${concrete}]::text[]`,
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
 * whole list. Neo4j had no equivalent gap because it matched any `BaseNode`. So a
 * new table must be added here the moment its domain is ported.
 *
 * `ProjectChangeRequest` is the sole deliberate omission: changesets are not
 * carried forward, so there is no table to register.
 */
const RESOURCE_TABLES: readonly ResourceTable[] = [
  ofOneType(users, 'User'),
  ofOneType(languages, 'Language'),
  ofOneType(partners, 'Partner'),
  ofSeveralTypes(
    projects,
    suffixed(projectTypeEnum.enumValues, 'Project'),
    'Project',
  ),
  ofSeveralTypes(
    engagements,
    suffixed(engagementTypeEnum.enumValues, 'Engagement'),
    'Engagement',
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

const toBaseNode = (row: ResourceRow): BaseNode => ({
  identity: row.id,
  labels: [...row.labels, 'BaseNode'],
  properties: { id: row.id, createdAt: DateTime.fromJSDate(row.createdAt) },
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
  return rows.map((row) => ({
    id: row.id as ID,
    createdAt: row.createdAt as Date,
    labels: row.labels,
  }));
};

/**
 * Resolve an arbitrary resource id to a Neo4j-shaped {@link BaseNode} by probing
 * every table in the registry — the same job the Neo4j `DtoRepository.getBaseNode(id)`
 * did against the single graph. Polymorphic domains (Comments, Post, ToolUsage)
 * hand the service this node so `ResourceLoader.loadByBaseNode` can resolve the
 * concrete type from `labels` and load the full DTO.
 *
 * Use this only when the caller has an id and no discriminator. When a stored
 * `*_type` column is available, prefer {@link resolveResourceBaseNodesByType} — it
 * reads fewer tables and can distinguish "deleted" from "unsupported type".
 *
 * migration-todo: delete at Phase 7 cutover with the rest of the Neo4j/BaseNode
 * compatibility shims.
 */
export const resolveResourceBaseNode = async (
  db: DrizzleDb,
  id: ID,
): Promise<BaseNode | undefined> => {
  const rows = await runBranches(
    RESOURCE_TABLES.map((table) => table.branch(db, [id])),
  );
  return rows[0] ? toBaseNode(rows[0]) : undefined;
};

/**
 * Batched id → {@link BaseNode} probe: one statement regardless of how many ids or
 * how many tables are registered.
 */
export const resolveResourceBaseNodes = async (
  db: DrizzleDb,
  ids: readonly ID[],
): Promise<ReadonlyMap<ID, BaseNode>> => {
  const unique = [...new Set(ids)];
  const nodes = new Map<ID, BaseNode>();
  if (unique.length === 0) return nodes;
  const rows = await runBranches(
    RESOURCE_TABLES.map((table) => table.branch(db, unique)),
  );
  for (const row of rows) nodes.set(row.id, toBaseNode(row));
  return nodes;
};

export interface ResolvedResourceBaseNodes {
  /**
   * The live node per id. An id whose row is missing or soft-deleted is ABSENT —
   * callers must drop it, matching the Cypher's required
   * `node(container, 'BaseNode')` match.
   */
  readonly nodes: ReadonlyMap<ID, BaseNode>;
  /**
   * `__typename`s no registry entry claims. This is a COVERAGE GAP, not a
   * deletion, and callers must surface it — silently dropping these makes a
   * newly-added resource type look exactly like one that was deleted.
   */
  readonly unknownTypes: ReadonlySet<string>;
}

/**
 * Resolve ids to {@link BaseNode}s using a stored discriminator, so only the
 * tables actually referenced are read — typically one or two per page rather than
 * the whole registry.
 *
 * The discriminator also lets a caller tell the two failure modes apart, which an
 * id-only probe cannot: a known type that resolved to nothing is a deleted
 * resource (drop it), while an unclaimed type means the registry is behind the
 * schema (a bug worth logging).
 */
export const resolveResourceBaseNodesByType = async (
  db: DrizzleDb,
  refs: ReadonlyArray<{ id: ID; type: string }>,
): Promise<ResolvedResourceBaseNodes> => {
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
  const nodes = new Map<ID, BaseNode>();
  for (const row of rows) nodes.set(row.id, toBaseNode(row));
  return { nodes, unknownTypes };
};
