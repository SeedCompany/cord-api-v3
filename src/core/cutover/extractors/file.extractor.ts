import { sql } from 'drizzle-orm';
import { type ID } from '~/common';
import { fileNodes, users } from '~/core/drizzle/schema';
import {
  bulkInsert,
  chunk,
  cypher,
  keepLanded,
  liveTargetIds,
  one,
  ts,
} from '../cutover.helpers';
import { type CutoverContext, type Extractor } from '../cutover.types';

/**
 * FileNode — the single-table Directory / File / FileVersion tree.
 *
 * ## Why this reads raw Cypher instead of going through FileRepository
 *
 * Every other extractor uses {@link readAllViaRepo} because the proven
 * `hydrate()` assembles the DTO for us. **This one must not.** `hydrateFile()`
 * (file.repository.ts:189-215) opens with `matchLatestVersion()`, which is a
 * REQUIRED `.match()` on `(node)<-[:parent ACTIVE]-(:FileVersion)`. A File with
 * no versions therefore does not hydrate at all — and version-less Files are not
 * an edge case, they are the normal resting state of every `DefinedFile`
 * placeholder (`createDefinedFile` makes the File row before any upload).
 * The local graph has ~7,559 File nodes against ~372 FileVersions, so reading
 * through the repository would silently shed the overwhelming majority of the
 * table and reconcile as a clean ✓ — the {@link warnIfLabelUnknown} failure mode,
 * one layer up.
 *
 * Reading raw is also strictly MORE faithful here: `hydrateFile`/`hydrateDirectory`
 * merge `{ public: false }` as a DTO default, while the column is deliberately
 * tri-state (`null` = inherit from parent). The raw Property value preserves that.
 *
 * ## Insert order
 *
 * `parent_id` and `latest_version_id` are both self-FKs, so one flat insert
 * cannot work:
 *
 * 1. Rows are sorted by **tree depth** (roots first) and inserted in that order,
 *    so a child never precedes its parent. Depth is computed from the parent map,
 *    with cycle protection — a cycle is impossible in the Neo4j model but a
 *    corrupt one would otherwise hang this loop rather than fail.
 * 2. `latest_version_id` is a **second pass**, because it points at a FileVersion
 *    that is itself a row in this table and cannot exist until step 1 finishes.
 *    Computed in JS from the landed set (max `createdAt` per File), then written
 *    with chunked `UPDATE … FROM (VALUES …)` — a per-row UPDATE would be one
 *    round trip per File, which is the wrong shape for the largest table here.
 *
 * ## Soft-delete
 *
 * LIVE-ONLY, for free: `deleteBaseNode` relabels to `Deleted_FileNode`, so
 * `MATCH (n:FileNode)` excludes soft-deleted nodes without a predicate. Same
 * reason a soft-deleted parent yields `parentId = null` (its label is gone AND
 * the inbound `parent` rel was deactivated) — those become roots, and the count
 * is logged rather than left silent.
 *
 * ## Rows this DROPS (loudly — never silently)
 *
 * - **FileVersion with no `mimeType` or `size`.** The `file_nodes_shape` CHECK
 *   requires both to be NOT NULL for that type. Dropping is deliberate over
 *   defaulting: inventing `application/octet-stream`/`0` would fabricate
 *   user-visible metadata for a version that cannot be served correctly anyway.
 *   The drop fans out correctly on its own — the `latest_version_id` pass and the
 *   media extractor both build from {@link liveTargetIds}, i.e. what LANDED.
 * - **Any node whose `createdBy` user did not land.** `created_by_id` is NOT NULL
 *   with an FK; there is nothing to write.
 *
 * A missing `name` is treated differently — defaulted, not dropped — because
 * dropping a Directory would orphan its whole subtree, and a blank name is
 * cosmetic and fixable in-app. Both counts are logged; check them against a real
 * Neo4j on the first prod-shaped run before trusting either policy.
 *
 * ## Local-graph count check (2026-08-03)
 *
 * 8,275 `:FileNode` — 7,559 File / 345 Directory / 372 FileVersion, which sums to
 * 8,276, i.e. ONE more than the interface label. The extra is a single junk node
 * `{id: '$p'}` labelled `[BaseNode, File]` — an unsubstituted query parameter that
 * got persisted — with **zero** relationships in either direction and no
 * `FileNode` label. Matching on `:FileNode` excludes it, and since nothing
 * references it the exclusion cannot orphan anything; it also has no `createdBy`,
 * so it could never satisfy `created_by_id` regardless. Recorded so the arithmetic
 * gap does not get re-investigated. Worth a look on the prod graph: any extractor
 * that enumerates by a SUBTYPE label rather than the interface label would pick
 * junk like this up (the queries here and in the media/PnP extractors all require
 * an edge, so they cannot).
 */

interface RawFileNode {
  id: ID;
  type: 'Directory' | 'File' | 'FileVersion' | null;
  name: string | null;
  public: boolean | null;
  mimeType: string | null;
  size: number | null;
  parentId: ID | null;
  createdById: ID<'User'> | null;
  createdAt: { toJSDate: () => Date } | null;
}

const READ = `
  MATCH (n:FileNode)
  OPTIONAL MATCH (n)-[:parent { active: true }]->(p:FileNode)
  OPTIONAL MATCH (n)-[:createdBy { active: true }]->(cb:User)
  OPTIONAL MATCH (n)-[:name { active: true }]->(nameProp:Property)
  OPTIONAL MATCH (n)-[:public { active: true }]->(pubProp:Property)
  OPTIONAL MATCH (n)-[:mimeType { active: true }]->(mimeProp:Property)
  OPTIONAL MATCH (n)-[:size { active: true }]->(sizeProp:Property)
  RETURN n.id AS id,
         [l IN labels(n) WHERE l IN ['Directory', 'File', 'FileVersion']][0] AS type,
         nameProp.value AS name,
         pubProp.value AS public,
         mimeProp.value AS mimeType,
         sizeProp.value AS size,
         p.id AS parentId,
         cb.id AS createdById,
         n.createdAt AS createdAt
`;

/** Neo4j may hand back an Integer wrapper rather than a JS number. */
const toNum = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  if (typeof (value as { toNumber?: unknown }).toNumber === 'function') {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
};

/**
 * Depth of each node in the parent tree, so inserts can be ordered roots-first.
 * A parent outside `byId` (soft-deleted, or dropped upstream) counts as a root.
 * Memoized and iterative rather than recursive — directory nesting is unbounded,
 * and a corrupt cycle must terminate rather than blow the stack.
 *
 * `cycles` collects any node that walked into a loop, so the caller can report it
 * instead of letting the insert die on a bare `*_fkey` violation.
 */
const depthOf = (
  byId: ReadonlyMap<ID, RawFileNode>,
  cache: Map<ID, number>,
  cycles: Set<ID>,
  start: ID,
): number => {
  const path: ID[] = [];
  const seen = new Set<ID>();
  let cursor: ID | undefined = start;
  while (cursor != null && cache.get(cursor) == null && !seen.has(cursor)) {
    seen.add(cursor);
    path.push(cursor);
    // Annotated: without it TS reports a control-flow circularity between this
    // const and the `cursor` reassignment below (TS7022).
    const parentId: ID | null | undefined = byId.get(cursor)?.parentId;
    cursor = parentId != null && byId.has(parentId) ? parentId : undefined;
  }
  // `base` is the depth of the walked path's PARENT, so the first node unwound
  // lands at base + 1. A run off the top of the tree gives -1, i.e. root = 0.
  let base: number;
  if (cursor == null) {
    base = -1;
  } else {
    const cached = cache.get(cursor);
    if (cached != null) {
      base = cached;
    } else {
      // Cursor is in `seen` → we walked into a cycle.
      cycles.add(start);
      base = -1;
    }
  }
  for (const id of [...path].reverse()) {
    base++;
    cache.set(id, base);
  }
  return cache.get(start)!;
};

/** Write `latest_version_id` in chunks: one statement per chunk, not per row. */
const writeLatestVersions = async (
  ctx: CutoverContext,
  pairs: ReadonlyArray<readonly [fileId: ID, versionId: ID]>,
) => {
  for (const batch of chunk(pairs, ctx.batchSize)) {
    // Explicit ::text casts: a bare parameter inside VALUES has unknown type, and
    // joining it against a text column then fails with "could not determine data
    // type". A dry run cannot surface this — it never issues the statement.
    const values = sql.join(
      batch.map(
        ([fileId, versionId]) => sql`(${fileId}::text, ${versionId}::text)`,
      ),
      sql`, `,
    );
    await ctx.db.execute(sql`
      UPDATE file_nodes AS f
      SET latest_version_id = v.version_id
      FROM (VALUES ${values}) AS v(file_id, version_id)
      WHERE f.id = v.file_id
    `);
  }
};

export const fileExtractor: Extractor = {
  name: 'file',
  targetTables: ['file_nodes'],
  dependsOn: ['user'],
  async run(ctx) {
    const raw = await cypher<RawFileNode>(ctx, READ);
    const userIds = await liveTargetIds(ctx, 'User', users);

    const typeless = raw.filter((row) => row.type == null);
    if (typeless.length > 0) {
      ctx.log(
        `    ⚠ ${typeless.length} FileNode(s) carry none of Directory/File/FileVersion — dropped`,
      );
    }
    const typed = raw.filter(
      (row): row is RawFileNode & { type: NonNullable<RawFileNode['type']> } =>
        row.type != null,
    );

    // CHECK file_nodes_shape: FileVersion requires mime_type + size NOT NULL.
    const shapeless = typed.filter(
      (row) =>
        row.type === 'FileVersion' &&
        (row.mimeType == null || row.size == null),
    );
    if (shapeless.length > 0) {
      ctx.log(
        `    ⚠ ${shapeless.length} FileVersion(s) missing mimeType and/or size — DROPPED ` +
          `(file_nodes_shape CHECK requires both): ${shapeless
            .slice(0, 10)
            .map((row) => row.id)
            .join(', ')}${shapeless.length > 10 ? ', …' : ''}`,
      );
    }
    const shaped = typed.filter(
      (row) =>
        !(
          row.type === 'FileVersion' &&
          (row.mimeType == null || row.size == null)
        ),
    );

    const unnamed = shaped.filter((row) => row.name == null);
    if (unnamed.length > 0) {
      ctx.log(
        `    ⚠ ${unnamed.length} FileNode(s) have no name Property — defaulted to '(unnamed)' ` +
          `rather than dropped (dropping a Directory orphans its subtree)`,
      );
    }

    const { kept, skipped } = keepLanded(shaped, [
      [userIds, (row) => row.createdById],
    ]);
    if (skipped > 0) {
      ctx.log(
        `    ⚠ ${skipped} FileNode(s) skipped — createdBy user absent or did not land ` +
          `(created_by_id is NOT NULL)`,
      );
    }

    const byId = new Map(kept.map((row) => [row.id, row]));
    const orphaned = kept.filter(
      (row) => row.parentId != null && !byId.has(row.parentId),
    ).length;
    if (orphaned > 0) {
      ctx.log(
        `    ⚠ ${orphaned} FileNode(s) point at a parent that is absent (soft-deleted or dropped) ` +
          `— inserted as roots with parent_id null`,
      );
    }

    const depthCache = new Map<ID, number>();
    const cycles = new Set<ID>();
    const ordered = [...kept].sort(
      (a, b) =>
        depthOf(byId, depthCache, cycles, a.id) -
        depthOf(byId, depthCache, cycles, b.id),
    );
    if (cycles.size > 0) {
      ctx.log(
        `    ⚠⚠ ${cycles.size} FileNode(s) sit in a parent CYCLE — depth ordering cannot ` +
          `satisfy the self-FK and the insert will fail on file_nodes_parent_id_fkey. ` +
          `Ids: ${[...cycles].slice(0, 10).join(', ')}`,
      );
    }

    const undated = kept.filter((row) => row.createdAt == null).length;
    if (undated > 0) {
      ctx.log(
        `    ⚠ ${undated} FileNode(s) have no createdAt — every BaseNode should carry one; ` +
          `falling back to the epoch, which is visible in the data rather than silent`,
      );
    }

    const isVersion = (row: RawFileNode) => row.type === 'FileVersion';
    const rows = ordered.map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name ?? '(unnamed)',
      public: row.public ?? null,
      parentId:
        row.parentId != null && byId.has(row.parentId) ? row.parentId : null,
      createdById: row.createdById!,
      // The CHECK confines these to FileVersion — a File carrying a stray
      // mimeType/size Property must still write null, or the insert aborts.
      mimeType: isVersion(row) ? row.mimeType : null,
      size: isVersion(row) ? toNum(row.size) : null,
      // Second pass; see the docblock.
      latestVersionId: null,
      createdAt: ts(row.createdAt) ?? new Date(0),
      deletedAt: null,
    }));

    const inserted = await bulkInsert(ctx, fileNodes, rows);

    // Pass 2: latest_version_id = the newest LANDED FileVersion under each File.
    if (!ctx.dryRun) {
      const landed = await liveTargetIds(ctx, 'FileNode', fileNodes);
      const newest = new Map<ID, { id: ID; at: number }>();
      for (const row of kept) {
        if (!isVersion(row) || row.parentId == null) continue;
        if (!landed.has(row.id) || !landed.has(row.parentId)) continue;
        const at = row.createdAt ? row.createdAt.toJSDate().getTime() : 0;
        const held = newest.get(row.parentId);
        if (!held || at > held.at) newest.set(row.parentId, { id: row.id, at });
      }
      const pairs = [...newest].map(
        ([fileId, latest]) => [fileId, latest.id] as const,
      );
      await writeLatestVersions(ctx, pairs);
      ctx.log(`    ✓ latest_version_id set on ${pairs.length} File(s)`);
    }

    // `read` is the count BEFORE the typeless / shapeless / unlanded-creator
    // filters above, so every one of those drops shows up as a read-vs-inserted
    // gap in the reconciliation table. Passing `rows.length` (the post-filter
    // count) would make read equal inserted and print ✓ on a table that shed
    // rows, while the ⚠ lines above said otherwise.
    return one('file_nodes', raw.length, inserted);
  },
};
