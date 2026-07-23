import { sql } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { type ID } from '~/common';
import { type DrizzleDb } from '~/core/drizzle';
import { type BaseNode } from '~/core/neo4j/results';

type Attachment = [resource: BaseNode, relation: string];

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
    -- No deleted_at filter — periodic_reports isn't soft-deleted (it cascades
    -- from its parent project/engagement), so the column doesn't exist.
    SELECT report_file_id, id, type || 'Report', 'reportFile', created_at
      FROM periodic_reports WHERE report_file_id IN (${ids})
    UNION ALL
    SELECT narrative_file_id, id, type || 'Report', 'narrativeFile', created_at
      FROM periodic_reports WHERE narrative_file_id IN (${ids})
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
 * Single-file convenience: walk from a file node to its tree root, then resolve
 * the attached resource. Backs `Media.attachedTo`. Returns undefined when
 * nothing references the root (e.g. a test root dir, or a free-floating tree).
 */
export async function resolveFileRootAttachment(
  db: DrizzleDb,
  startFileNodeId: ID,
): Promise<Attachment | undefined> {
  const rootRes = await db.execute<{ rootId: ID }>(sql`
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_id, 0 AS depth FROM file_nodes WHERE id = ${startFileNodeId}
      UNION ALL
      SELECT p.id, p.parent_id, a.depth + 1
      FROM ancestors a JOIN file_nodes p ON p.id = a.parent_id
    )
    SELECT id AS "rootId" FROM ancestors ORDER BY depth DESC LIMIT 1
  `);
  const rootId = rootRes.rows[0]?.rootId;
  if (!rootId) {
    return undefined;
  }
  const map = await reverseAttachmentByRootIds(db, [rootId]);
  return map.get(rootId);
}
