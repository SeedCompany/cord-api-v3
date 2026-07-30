import { type Type } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { type PgTable } from 'drizzle-orm/pg-core';
import {
  type CalendarDate,
  type ID,
  RichTextDocument,
  type UnsecuredDto,
} from '~/common';
import { type CutoverContext, type TableStat } from './cutover.types';

/** Split an array into fixed-size chunks. */
export const chunk = <T>(items: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, i * size + size),
  );

/**
 * Enumerate the ids of every node with `label`.
 *
 * `label` must be an actual NEO4J label — PascalCase, no dots. The label is
 * backticked so a dotted name is syntactically legal, which is precisely the
 * trap: `Ethnologue.Language` and `File.Version` are **Gel** module paths and
 * match nothing. This docblock used to cite them as working examples; it was
 * wrong and the ethnologue extractor shipped that way, migrating zero rows with
 * a green ✓. See {@link warnIfLabelUnknown}.
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
  if (rows.length === 0) {
    await warnIfLabelUnknown(ctx, label);
  }
  return rows.map((r) => r.id);
};

/** Labels actually in use in the source graph. Fetched once per run. */
let knownLabels: ReadonlySet<string> | undefined;

/**
 * A wrong label is the worst failure this harness has, because it is SILENT:
 * `MATCH (n:\`Nope\`)` returns zero rows exactly like an empty domain, so the
 * extractor reports 0 and reconciliation confirms 0 == 0 == 0 with a ✓.
 *
 * This actually happened — `ethnologue` queried `Ethnologue.Language`, which is
 * the **Gel** module path (`e.Ethnologue.Language`) and not a Neo4j label. The
 * whole domain migrated as zero rows and every check passed. The docblock on
 * this file even suggested `File.Version` as an example, so later waves would
 * have inherited it.
 *
 * Warn rather than throw: a genuinely empty domain whose label was never created
 * also yields zero, and that is legitimate. The point is to make the ambiguity
 * loud instead of invisible.
 */
const warnIfLabelUnknown = async (ctx: CutoverContext, label: string) => {
  knownLabels ??= new Set(
    (
      await ctx.neo4j
        .query<{ label: string }>('CALL db.labels() YIELD label RETURN label')
        .run()
    ).map((row) => row.label),
  );
  if (!knownLabels.has(label)) {
    ctx.log(
      `    ⚠⚠ label "${label}" is NOT in db.labels() and matched 0 nodes — either the domain is ` +
        `genuinely empty, or the label is wrong. Neo4j labels are PascalCase with NO dots; a Gel ` +
        `module path (e.g. "Ethnologue.Language", "File.Version") silently matches nothing.`,
    );
  }
};

/** Relationship types actually in use in the source graph. Fetched once per run. */
let knownRelTypes: ReadonlySet<string> | undefined;

/**
 * The {@link warnIfLabelUnknown} guard, for RELATIONSHIP types.
 *
 * The label guard covers nodes only, and several domains are stored purely as
 * edges — `(:User)-[:pinned]->(:BaseNode)`,
 * `(:User)-[:knownLanguage { value }]->(:Language)`. A misspelled rel type in a
 * raw `cypher()` query returns zero rows exactly like an empty domain and
 * reconciles `0 == 0 == 0 ✓`: the same silent failure as the ethnologue label
 * bug, in a dimension the existing guard cannot see.
 *
 * This is not hypothetical. `knownLanguage` has **zero** edges in the local
 * graph, so a correct query and a typo produce byte-identical output, and
 * nothing else in the harness can tell them apart.
 *
 * Warns rather than throws — a genuinely empty domain whose rel type was never
 * minted also yields zero, and that is legitimate.
 */
export const warnIfRelTypeUnknown = async (
  ctx: CutoverContext,
  relType: string,
) => {
  knownRelTypes ??= new Set(
    (
      await ctx.neo4j
        .query<{
          relationshipType: string;
        }>(
          'CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType',
        )
        .run()
    ).map((row) => row.relationshipType),
  );
  if (!knownRelTypes.has(relType)) {
    ctx.log(
      `    ⚠⚠ relationship type "${relType}" is NOT in db.relationshipTypes() and matched 0 rows — ` +
        `either the domain is genuinely empty, or the type name is wrong. Node labels have their own ` +
        `guard (warnIfLabelUnknown); edge-stored domains like pins and known languages need this one.`,
    );
  }
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

/**
 * Drop junction/child rows whose referenced parent never LANDED in Postgres.
 *
 * This is the harness's most common real-load failure and it is a HARD one — a
 * `*_fkey` violation aborts the whole run. It happens because junctions are read
 * with raw Cypher over ALL nodes of a label, which is a superset of what landed:
 * `readMany` silently omits nodes with broken required rels, and
 * `onConflictDoNothing` drops unique-conflicts. Neither is visible to the
 * junction query.
 *
 * Pass one entry per FK column. Returns the surviving rows plus a skip count to
 * log — never drop silently.
 *
 * Found by a real (non-dry) scratch-DB run: dry-run cannot surface this class at
 * all, because it never inserts.
 */
export const keepLanded = <T>(
  rows: readonly T[],
  refs: ReadonlyArray<
    readonly [
      landed: ReadonlySet<string>,
      idOf: (row: T) => string | null | undefined,
    ]
  >,
): { kept: T[]; skipped: number } => {
  const kept = rows.filter((row) =>
    refs.every(([landed, idOf]) => {
      const id = idOf(row);
      return id != null && landed.has(id);
    }),
  );
  return { kept, skipped: rows.length - kept.length };
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
): Promise<Array<UnsecuredDto<T>>> =>
  await readAllRowsViaRepo<UnsecuredDto<T>>(ctx, label, repoClass);

/**
 * Same as {@link readAllViaRepo}, but for repositories whose `readMany` returns
 * a purpose-built ROW type rather than an `UnsecuredDto<T>` — Product's
 * `HydratedProductRow` is the case in point (it carries `isOverriding` and raw
 * ScriptureRange nodes the DTO does not have). Kept as a sibling rather than
 * loosening `readAllViaRepo`'s generic, which would silently change what the ten
 * existing `readAllViaRepo<Foo>()` call sites resolve to.
 */
export const readAllRowsViaRepo = async <TRow extends { id: ID }>(
  ctx: CutoverContext,
  label: string,
  repoClass: Type<{
    readMany: (ids: readonly ID[]) => Promise<readonly TRow[]>;
  }>,
): Promise<TRow[]> => {
  const repo = ctx.moduleRef.get(repoClass, { strict: false });
  const ids = await fetchIds(ctx, label);
  const out: TRow[] = [];
  for (const ids_ of chunk(ids, ctx.batchSize)) {
    out.push(...(await repo.readMany(ids_)));
  }
  // Hydrate-drop guard (finding #8): readMany silently omits nodes whose
  // required matches fail (e.g. a partnership whose [:partner] rel was
  // deactivated by its Partner's soft-delete). Reconciliation can't catch it —
  // the read stat counts hydrated DTOs — so surface the delta here.
  if (out.length !== ids.length) {
    const hydrated = new Set<string>(out.map((row) => String(row.id)));
    const missing = ids.filter((id) => !hydrated.has(id));
    ctx.log(
      `    ⚠ ${label}: ${missing.length} node(s) enumerated but NOT hydrated by readMany ` +
        `(broken required rels — prod-finding #2 class): ${missing
          .slice(0, 10)
          .join(', ')}${missing.length > 10 ? ', …' : ''}`,
    );
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
    // Count what Postgres ACTUALLY wrote, not what we handed it. Adding
    // `c.length` here reported attempted-not-written, so a unique-conflict drop
    // showed as `inserted 69` against `pgCount 50` and the "inserted" column was
    // simply false. Only the pgCount comparison caught it; now both agree.
    const res = await ctx.db.insert(table).values(c).onConflictDoNothing();
    n += (res as { rowCount?: number | null }).rowCount ?? c.length;
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

/**
 * The stored rich-text value → the plain object a `jsonb` column takes.
 *
 * Neo4j stores rich text as a NUL-delimited tagged string
 * (`'\0RichText\0' + JSON` — see RichTextDocument.serializedPrefix). The Neo4j
 * read transformer (`core/neo4j/transformer.ts`) parses it back into a
 * RichTextDocument on the way out, so the first branch is the normal path; the
 * serialized branch covers a value the transformer did not reach (nested inside
 * a map, say).
 *
 * Handling that second case is not optional politeness. **Postgres text and
 * jsonb cannot store a NUL byte at all**, so letting the serialized form through
 * is a hard insert failure, not a cosmetically-wrong row.
 *
 * `undefined` = present but unusable (the caller decides: null the column, or
 * drop the row if it is NOT NULL); `null` = genuinely empty at the source.
 */
export const richText = (value: unknown): object | null | undefined => {
  if (value == null) return null;
  if (RichTextDocument.isSerialized(value)) {
    try {
      return { ...RichTextDocument.fromSerialized(value) };
    } catch {
      return undefined;
    }
  }
  if (typeof value === 'object') return { ...value };
  return undefined;
};

/**
 * Batched mirror of `resolveResourceBaseNode` (`~/core/drizzle`): resolve
 * polymorphic parent ids to the **concrete typename** the read path expects in
 * a `parent_type` discriminator column (`comment_threads`, `posts`).
 *
 * Why mirror instead of reusing it: that function issues six queries per id, and
 * these domains resolve one parent per row. This resolves the whole distinct set
 * in six queries total.
 *
 * Why not read the Neo4j labels instead: `labels(parent)` is unordered and
 * carries interface noise — a project comes back as
 * `["BaseNode","Project","MomentumTranslationProject"]` and a language as
 * `["BaseNode","Language","Commentable"]`, so neither the first nor the last
 * entry is the answer. The PG read path rebuilds the parent as
 * `labels: [parent_type, 'BaseNode']`, so the column must hold exactly the
 * string the resolver would have produced.
 *
 * ⚠ The precedence order below MUST match `resolveResourceBaseNode`'s
 * (user → language → partner → project → engagement → progressReport). An id
 * absent from the returned map either did not land or is soft-deleted, which
 * makes this double as the landed-parent guard.
 */
export const resolveParentTypes = async (
  ctx: CutoverContext,
  ids: readonly string[],
): Promise<Map<string, string>> => {
  const out = new Map<string, string>();
  const distinct = [...new Set(ids)];
  if (distinct.length === 0) return out;
  const list = sql.join(
    distinct.map((id) => sql`${id}`),
    sql`, `,
  );
  // Lowest precedence first, so a higher-precedence match overwrites it.
  // EVERY leg must alias the type expression `AS t`. Postgres names an
  // unaliased expression `?column?`, so a missing alias makes `row.t` undefined
  // — and `out.set(id, undefined)` still creates the KEY, which silently defeats
  // any `keepLanded` guard built from `.keys()` and then fails downstream on a
  // NOT NULL discriminator. That is exactly how this shipped the first time; the
  // filter below is the structural backstop so an alias slip can only ever lose
  // a row loudly, never write a null.
  const legs = [
    sql`SELECT id, 'ProgressReport' AS t FROM periodic_reports WHERE id IN (${list}) AND type = 'Progress'`,
    sql`SELECT id, type || 'Engagement' AS t FROM engagements WHERE id IN (${list}) AND deleted_at IS NULL`,
    sql`SELECT id, type || 'Project' AS t FROM projects WHERE id IN (${list}) AND deleted_at IS NULL`,
    sql`SELECT id, 'Partner' AS t FROM partners WHERE id IN (${list}) AND deleted_at IS NULL`,
    sql`SELECT id, 'Language' AS t FROM languages WHERE id IN (${list}) AND deleted_at IS NULL`,
    sql`SELECT id, 'User' AS t FROM users WHERE id IN (${list}) AND deleted_at IS NULL`,
  ];
  for (const leg of legs) {
    const res = await ctx.db.execute<{ id: string; t: string }>(leg);
    for (const row of res.rows) {
      if (!row.t) continue;
      out.set(row.id, row.t);
    }
  }
  return out;
};

/** LinkTo<T> | { id } | null → the id string, or null. */
export const linkId = <T extends string>(
  link: { id: ID<T> } | ID<T> | null | undefined,
): ID<T> | null => {
  if (!link) return null;
  return typeof link === 'string' ? link : link.id;
};
