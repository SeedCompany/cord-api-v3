import { sql } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { type ID } from '~/common';
import { type DrizzleDb } from '~/core/drizzle';
import { type BaseNode } from '~/core/neo4j/results';

export type Attachment = [resource: BaseNode, relation: string];

/**
 * Reverse of {@link resolveResourceBaseNode}: given file tree *root* ids, find
 * the resource each root is attached to — by matching the root id against every
 * consuming DefinedFile FK column — and build the owning resource as a
 * Neo4j-shaped {@link BaseNode}. The Postgres equivalent of the Neo4j
 * `MATCH (resource)-[rel]->(root)` in the File/Media hydrate.
 *
 * Batched (one UNION query for all roots) because FileNode.rootAttachedTo is
 * computed for every hydrated node.
 *
 * migration-todo: delete at Phase 7 cutover with the Neo4j/BaseNode shims.
 */
export async function reverseAttachmentByRootIds(
  db: DrizzleDb,
  rootIds: readonly ID[],
): Promise<Map<ID, Attachment>> {
  const map = new Map<ID, Attachment>();
  if (rootIds.length === 0) {
    return map;
  }
  const ids = sql.join(
    rootIds.map((id) => sql`${id}`),
    sql`, `,
  );
  // Each consuming table's DefinedFile FK column → (root id, owner, relation,
  // concrete resource label). project/engagement carry a subtype discriminator.
  // The relation name mirrors the Neo4j `{propName}Node` edge but isn't read by
  // any consumer (only the resource matters), so the clean propName is fine.
  const rows = await db.execute<{
    rootId: ID;
    ownerId: ID;
    label: string;
    relation: string;
    createdAt: Date | string;
  }>(sql`
    SELECT root_directory_id AS "rootId", id AS "ownerId", type || 'Project' AS "label",
           'rootDirectory' AS "relation", created_at AS "createdAt"
      FROM projects WHERE root_directory_id IN (${ids}) AND deleted_at IS NULL
    UNION ALL
    SELECT photo_id, id, 'User', 'photo', created_at
      FROM users WHERE photo_id IN (${ids}) AND deleted_at IS NULL
    UNION ALL
    SELECT map_image_id, id, 'Location', 'mapImage', created_at
      FROM locations WHERE map_image_id IN (${ids}) AND deleted_at IS NULL
    UNION ALL
    SELECT mou_id, id, 'Partnership', 'mou', created_at
      FROM partnerships WHERE mou_id IN (${ids}) AND deleted_at IS NULL
    UNION ALL
    SELECT agreement_id, id, 'Partnership', 'agreement', created_at
      FROM partnerships WHERE agreement_id IN (${ids}) AND deleted_at IS NULL
    UNION ALL
    SELECT pnp_id, id, type || 'Engagement', 'pnp', created_at
      FROM engagements WHERE pnp_id IN (${ids}) AND deleted_at IS NULL
    UNION ALL
    SELECT growth_plan_id, id, type || 'Engagement', 'growthPlan', created_at
      FROM engagements WHERE growth_plan_id IN (${ids}) AND deleted_at IS NULL
    UNION ALL
    SELECT universal_template_file_id, id, 'Budget', 'universalTemplateFile', created_at
      FROM budgets WHERE universal_template_file_id IN (${ids}) AND deleted_at IS NULL
    UNION ALL
    SELECT file_id, id, 'ProgressReportMedia', 'media', created_at
      FROM progress_report_media WHERE file_id IN (${ids}) AND deleted_at IS NULL
    UNION ALL
    -- reportFile + narrativeFile live on the base PeriodicReport, so the label
    -- is the concrete report type: 'Progress'/'Financial'/'Narrative' || 'Report'.
    -- periodic_reports gained deleted_at in migration 0034 (soft delete,
    -- matching Neo4j) — filter it like every other arm here.
    SELECT report_file_id, id, type || 'Report', 'reportFile', created_at
      FROM periodic_reports WHERE report_file_id IN (${ids}) AND deleted_at IS NULL
    UNION ALL
    SELECT narrative_file_id, id, type || 'Report', 'narrativeFile', created_at
      FROM periodic_reports WHERE narrative_file_id IN (${ids}) AND deleted_at IS NULL
  `);
  for (const r of rows.rows) {
    const baseNode: BaseNode = {
      identity: r.ownerId,
      labels: [r.label, 'BaseNode'],
      properties: {
        id: r.ownerId,
        createdAt:
          r.createdAt instanceof Date
            ? DateTime.fromJSDate(r.createdAt)
            : DateTime.fromSQL(r.createdAt),
      },
    } as unknown as BaseNode;
    map.set(r.rootId, [baseNode, r.relation]);
  }
  return map;
}

/**
 * BATCHED: walk many file nodes to their tree roots, then resolve each root's
 * attached resource — two queries total regardless of input size.
 *
 * The per-node version below is a wrapper over this one. Media's `readMany` is
 * the batch path a DataLoader feeds, and calling the single version per row cost
 * a recursive ancestor CTE **plus** the 11-branch UNION for every media row —
 * 2N round trips for one page.
 */
export async function resolveFileRootAttachments(
  db: DrizzleDb,
  startFileNodeIds: readonly ID[],
): Promise<Map<ID, Attachment>> {
  const out = new Map<ID, Attachment>();
  const starts = [...new Set(startFileNodeIds)];
  if (starts.length === 0) {
    return out;
  }
  const ids = sql.join(
    starts.map((id) => sql`${id}`),
    sql`, `,
  );
  // Carry the originating id through the recursion so one walk serves every
  // start node; DISTINCT ON picks each start's deepest ancestor, i.e. its root.
  const rootRes = await db.execute<{ startId: ID; rootId: ID }>(sql`
    WITH RECURSIVE ancestors AS (
      SELECT id AS start_id, id, parent_id, 0 AS depth
        FROM file_nodes WHERE id IN (${ids})
      UNION ALL
      SELECT a.start_id, p.id, p.parent_id, a.depth + 1
        FROM ancestors a JOIN file_nodes p ON p.id = a.parent_id
    )
    SELECT DISTINCT ON (start_id) start_id AS "startId", id AS "rootId"
      FROM ancestors ORDER BY start_id, depth DESC
  `);
  const rootByStart = new Map(
    rootRes.rows.map((row) => [row.startId, row.rootId]),
  );
  const attachmentByRoot = await reverseAttachmentByRootIds(db, [
    ...new Set(rootByStart.values()),
  ]);
  for (const [startId, rootId] of rootByStart) {
    const attachment = attachmentByRoot.get(rootId);
    if (attachment) {
      out.set(startId, attachment);
    }
  }
  return out;
}

/**
 * Single-file convenience over {@link resolveFileRootAttachments}. Backs
 * `Media.attachedTo` on the single-read paths. Returns undefined when nothing
 * references the root (e.g. a test root dir, or a free-floating tree).
 */
export async function resolveFileRootAttachment(
  db: DrizzleDb,
  startFileNodeId: ID,
): Promise<Attachment | undefined> {
  const map = await resolveFileRootAttachments(db, [startFileNodeId]);
  return map.get(startFileNodeId);
}
