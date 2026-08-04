import { and, eq, inArray, isNull } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { type ID } from '~/common';
import { type BaseNode } from '~/core/neo4j/results';
import { type DrizzleDb } from './drizzle.service';
import {
  engagements,
  engagementTypeEnum,
  languages,
  partners,
  periodicReports,
  projects,
  projectTypeEnum,
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
 * This registry is the single place that knows (a) which tables a polymorphic
 * id can live in, (b) which concrete `__typename`s each yields, and (c) the
 * liveness rule for each. Adding a resource type to the polymorphic universe is
 * one entry here, and both the id-probe and the discriminator-keyed lookup pick
 * it up.
 *
 * `fetch` MUST filter liveness. A soft-deleted row must not resolve: Neo4j's
 * soft delete strips every label including `BaseNode`, so the Cypher's
 * `node(container, 'BaseNode')` match drops it. Returning it here instead
 * produces a live-looking node that the concrete ResourceLoader will then fail
 * to load — surfacing as `NotFoundException` inside a non-null GraphQL field.
 */
interface ResourceTable {
  /** The concrete GraphQL `__typename`s this table can yield. */
  readonly typenames: readonly string[];
  /** Live rows for these ids. Absent + soft-deleted rows are omitted. */
  readonly fetch: (db: DrizzleDb, ids: readonly ID[]) => Promise<ResourceRow[]>;
}

/**
 * Concrete `__typename`s of the polymorphic subtype families, derived from the
 * DB enums so a newly added subtype registers itself everywhere rather than
 * needing each hand-maintained list to be found and extended.
 */
export const PROJECT_TYPENAMES: readonly string[] =
  projectTypeEnum.enumValues.map((type) => `${type}Project`);
export const ENGAGEMENT_TYPENAMES: readonly string[] =
  engagementTypeEnum.enumValues.map((type) => `${type}Engagement`);

/**
 * Probe order is the id-lookup precedence order, matching the pre-registry
 * helper. Ids are globally unique, so the order only matters if two tables ever
 * share one.
 */
const RESOURCE_TABLES: readonly ResourceTable[] = [
  {
    typenames: ['User'],
    fetch: async (db, ids) =>
      (
        await db
          .select({ id: users.id, createdAt: users.createdAt })
          .from(users)
          .where(
            and(
              inArray(users.id, [...ids] as Array<ID<'User'>>),
              isNull(users.deletedAt),
            ),
          )
      ).map((row) => ({ ...row, labels: ['User'] })),
  },
  {
    typenames: ['Language'],
    fetch: async (db, ids) =>
      (
        await db
          .select({ id: languages.id, createdAt: languages.createdAt })
          .from(languages)
          .where(
            and(
              inArray(languages.id, [...ids] as Array<ID<'Language'>>),
              isNull(languages.deletedAt),
            ),
          )
      ).map((row) => ({ ...row, labels: ['Language'] })),
  },
  {
    typenames: ['Partner'],
    fetch: async (db, ids) =>
      (
        await db
          .select({ id: partners.id, createdAt: partners.createdAt })
          .from(partners)
          .where(
            and(
              inArray(partners.id, [...ids] as Array<ID<'Partner'>>),
              isNull(partners.deletedAt),
            ),
          )
      ).map((row) => ({ ...row, labels: ['Partner'] })),
  },
  {
    typenames: PROJECT_TYPENAMES,
    fetch: async (db, ids) =>
      (
        await db
          .select({
            id: projects.id,
            createdAt: projects.createdAt,
            type: projects.type,
          })
          .from(projects)
          .where(
            and(
              inArray(projects.id, [...ids] as Array<ID<'Project'>>),
              isNull(projects.deletedAt),
            ),
          )
      ).map(({ type, ...row }) => ({
        ...row,
        labels: [`${type}Project`, 'Project'],
      })),
  },
  {
    typenames: ENGAGEMENT_TYPENAMES,
    fetch: async (db, ids) =>
      (
        await db
          .select({
            id: engagements.id,
            createdAt: engagements.createdAt,
            type: engagements.type,
          })
          .from(engagements)
          .where(
            and(
              inArray(engagements.id, [...ids] as Array<ID<'Engagement'>>),
              isNull(engagements.deletedAt),
            ),
          )
      ).map(({ type, ...row }) => ({
        ...row,
        labels: [`${type}Engagement`, 'Engagement'],
      })),
  },
  {
    // ProgressReport is a periodic_reports row with type='Progress'.
    // Soft-deleted as of migration 0035, hence the liveness filter.
    typenames: ['ProgressReport'],
    fetch: async (db, ids) =>
      (
        await db
          .select({
            id: periodicReports.id,
            createdAt: periodicReports.createdAt,
          })
          .from(periodicReports)
          .where(
            and(
              inArray(periodicReports.id, [...ids]),
              eq(periodicReports.type, 'Progress'),
              isNull(periodicReports.deletedAt),
            ),
          )
      ).map((row) => ({ ...row, labels: ['ProgressReport'] })),
  },
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
 * Resolve an arbitrary resource id to a Neo4j-shaped {@link BaseNode} by
 * probing every table in the registry — the same job the Neo4j
 * `DtoRepository.getBaseNode(id)` did against the single graph. Polymorphic
 * domains (Comments, Post, ToolUsage) hand the service this node so
 * `ResourceLoader.loadByBaseNode` can resolve the concrete type from `labels`
 * and load the full DTO.
 *
 * Use this only when the caller has an id and no discriminator. When a stored
 * `*_type` column is available, prefer {@link resolveResourceBaseNodesByType} —
 * it is both cheaper and able to distinguish "deleted" from "unsupported type".
 *
 * migration-todo: delete at Phase 7 cutover with the rest of the Neo4j/BaseNode
 * compatibility shims.
 */
export const resolveResourceBaseNode = async (
  db: DrizzleDb,
  id: ID,
): Promise<BaseNode | undefined> => {
  const perTable = await Promise.all(
    RESOURCE_TABLES.map(async (table) => await table.fetch(db, [id])),
  );
  for (const rows of perTable) {
    if (rows[0]) return toBaseNode(rows[0]);
  }
  return undefined;
};

/**
 * Batched id → {@link BaseNode} probe: one query per registry table regardless
 * of how many ids are passed. Bounded at the registry size, so it stays flat as
 * a page grows — unlike calling {@link resolveResourceBaseNode} per id.
 */
export const resolveResourceBaseNodes = async (
  db: DrizzleDb,
  ids: readonly ID[],
): Promise<ReadonlyMap<ID, BaseNode>> => {
  const unique = [...new Set(ids)];
  const nodes = new Map<ID, BaseNode>();
  if (unique.length === 0) return nodes;
  const perTable = await Promise.all(
    RESOURCE_TABLES.map(async (table) => await table.fetch(db, unique)),
  );
  for (const rows of perTable) {
    for (const row of rows) nodes.set(row.id, toBaseNode(row));
  }
  return nodes;
};

export interface ResolvedResourceBaseNodes {
  /**
   * The live node per id. An id whose row is missing or soft-deleted is
   * ABSENT — callers must drop it, matching the Cypher's required
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
 * tables actually referenced are queried — typically one or two per page rather
 * than the whole registry.
 *
 * The discriminator also lets a caller tell the two failure modes apart, which
 * an id-only probe cannot: a known type that resolved to nothing is a deleted
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
  const nodes = new Map<ID, BaseNode>();
  const perTable = await Promise.all(
    [...idsByTable].map(
      async ([table, ids]) => await table.fetch(db, [...ids]),
    ),
  );
  for (const rows of perTable) {
    for (const row of rows) nodes.set(row.id, toBaseNode(row));
  }
  return { nodes, unknownTypes };
};
