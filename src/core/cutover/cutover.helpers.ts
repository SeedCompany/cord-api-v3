import { type Type } from '@nestjs/common';
import { type PgTable } from 'drizzle-orm/pg-core';
import { type CalendarDate, type ID, type UnsecuredDto } from '~/common';
import { type CutoverContext, type TableStat } from './cutover.types';

/** Split an array into fixed-size chunks. */
export const chunk = <T>(items: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, i * size + size),
  );

/**
 * Enumerate the ids of every node with `label`. Backticks the label so dotted
 * labels (e.g. `Ethnologue.Language`, `File.Version`) work.
 *
 * migration-todo: this reads ALL nodes including soft-deleted ones if the
 * Neo4j model keeps them. The per-domain hydrate/readMany typically filters to
 * live rows; verify deleted-row handling against a real Neo4j before cutover.
 */
export const fetchIds = async (
  ctx: CutoverContext,
  label: string,
): Promise<ID[]> => {
  const rows = await ctx.neo4j
    .query<{ id: ID }>(`MATCH (n:\`${label}\`) RETURN n.id AS id`)
    .run();
  return rows.map((r) => r.id);
};

/**
 * The set of ids that actually LANDED in a Postgres target table — the truth
 * source for dangling-FK guards. Neo4j liveness isn't enough: a live source
 * row can be silently dropped by `onConflictDoNothing` (unique-dup class,
 * prod-finding #3), and anything referencing it must be nulled/dropped too.
 *
 * Dry-run inserts nothing, so fall back to the Neo4j id set there — mapped
 * counts can differ slightly from a real run when dups exist.
 */
export const liveTargetIds = async (
  ctx: CutoverContext,
  label: string,
  table: PgTable & { id: any },
): Promise<ReadonlySet<string>> => {
  if (ctx.dryRun) {
    return new Set(await fetchIds(ctx, label));
  }
  const rows: Array<{ id: unknown }> = await ctx.db
    .select({ id: table.id })
    .from(table);
  return new Set(rows.map((row) => String(row.id)));
};

/** Run an arbitrary read Cypher and return the rows (junction extraction). */
export const cypher = async <T>(
  ctx: CutoverContext,
  query: string,
): Promise<T[]> => {
  return [...(await ctx.neo4j.query<T>(query).run())];
};

/**
 * Read every node of `label` through its canonical (Neo4j) repository, so the
 * proven `hydrate()` assembles the full `UnsecuredDto`. Resolves the repo from
 * the container, enumerates ids, then batches `readMany`.
 */
export const readAllViaRepo = async <T extends { id: ID }>(
  ctx: CutoverContext,
  label: string,
  repoClass: Type<{
    readMany: (ids: readonly ID[]) => Promise<ReadonlyArray<UnsecuredDto<T>>>;
  }>,
): Promise<Array<UnsecuredDto<T>>> => {
  const repo = ctx.moduleRef.get(repoClass, { strict: false });
  const ids = await fetchIds(ctx, label);
  const out: Array<UnsecuredDto<T>> = [];
  for (const ids_ of chunk(ids, ctx.batchSize)) {
    out.push(...(await repo.readMany(ids_)));
  }
  return out;
};

/**
 * Insert rows into a Postgres table, chunked, ID-preserving,
 * `onConflictDoNothing` (idempotent re-runs). No-op write in dry-run — the
 * mapping still runs, so mapping errors still surface. Returns rows written
 * (or would-be-written in dry-run).
 */
export const bulkInsert = async <T extends PgTable>(
  ctx: CutoverContext,
  table: T,
  rows: ReadonlyArray<T['$inferInsert']>,
): Promise<number> => {
  if (rows.length === 0) return 0;
  if (ctx.dryRun) return rows.length;
  let n = 0;
  for (const c of chunk(rows, ctx.batchSize)) {
    await ctx.db.insert(table).values(c).onConflictDoNothing();
    n += c.length;
  }
  return n;
};

/**
 * Keep only enum values the target pgEnum actually declares. Real Neo4j data
 * can carry legacy/renamed enum values (e.g. `TranslationOrganization`) that
 * the Postgres enum rejects.
 *
 * migration-todo: this DROPS unknown values (data loss). Some are renames that
 * should MAP, not drop (likely `TranslationOrganization` → `Translation`).
 * Replace with an explicit value-map per enum once the team decides. Returns
 * `{ kept, dropped }` so callers can warn.
 */
export const sanitizeEnum = <T extends string>(
  values: readonly string[],
  allowed: readonly T[],
): { kept: T[]; dropped: string[] } => {
  const allowedSet = new Set<string>(allowed);
  const kept: T[] = [];
  const dropped: string[] = [];
  for (const v of values) {
    if (allowedSet.has(v)) kept.push(v as T);
    else dropped.push(v);
  }
  return { kept, dropped };
};

/** `read` and `inserted` are usually equal (onConflictDoNothing aside). */
export const stat = (read: number, inserted: number): TableStat => ({
  read,
  inserted,
});

/**
 * Single-table stats result: `{ [table]: { read, inserted } }`. The key is a
 * variable (not a snake_case literal), which keeps the naming-convention +
 * no-useless-computed-key lint rules happy.
 */
export const one = (
  table: string,
  read: number,
  inserted: number,
): Record<string, TableStat> => ({ [table]: { read, inserted } });

// ─── Value mappers ───────────────────────────────────────────────────────────
// UnsecuredDto dates are Luxon; Postgres `timestamp` columns (mode 'date')
// take a JS Date, `date` columns (mode 'string') take an ISO date string.

type Luxonish = { toJSDate: () => Date } | null | undefined;
type ISODateish =
  | CalendarDate
  | { toISO: () => string | null }
  | null
  | undefined;

/** Luxon DateTime → JS Date for `timestamp` columns. */
export const ts = (dt: Luxonish): Date | null => (dt ? dt.toJSDate() : null);

/** Non-null variant for NOT NULL timestamp columns (e.g. createdAt). */
export const tsReq = (dt: { toJSDate: () => Date }): Date => dt.toJSDate();

/** CalendarDate / DateTime → 'YYYY-MM-DD' for `date` columns. */
export const dateStr = (d: ISODateish): string | null => {
  if (!d) return null;
  const iso = d.toISO();
  return iso ? iso.slice(0, 10) : null;
};

/**
 * Coalesce a value that the DTO *types* as non-null but which real Neo4j data
 * can still hold null for (a Property node was never written). Mirrors the
 * column's schema default so the NOT NULL insert succeeds.
 */
export const orDefault = <T>(value: T | null | undefined, fallback: T): T =>
  value ?? fallback;

/** LinkTo<T> | { id } | null → the id string, or null. */
export const linkId = <T extends string>(
  link: { id: ID<T> } | ID<T> | null | undefined,
): ID<T> | null => {
  if (!link) return null;
  return typeof link === 'string' ? link : link.id;
};
