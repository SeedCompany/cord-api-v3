import { type ID } from '~/common';
import { fileNodes, media } from '~/core/drizzle/schema';
import {
  bulkInsert,
  cypher,
  keepLanded,
  liveTargetIds,
  one,
  ts,
  warnIfRelTypeUnknown,
} from '../cutover.helpers';
import { type Extractor } from '../cutover.types';

/**
 * Media — the image/video/audio metadata hanging off a FileVersion.
 *
 * Read raw rather than through `MediaRepository.readMany`: that method's
 * `hydrate()` (media.repository.ts:48-78) attaches a required
 * `MATCH (resource:BaseNode)-[rel]->(root)` to resolve `attachedTo`, which is a
 * GraphQL concern the table does not store — and a Media whose root directory is
 * not attached to anything would drop out of the read while still needing to
 * migrate.
 *
 * Unlike almost every other edge in the graph, `[:media]` carries **no `active`
 * flag** — the read path matches it bare (`relation('out', '', 'media')`), so this
 * query must not filter on one either. Filtering would return zero rows and
 * reconcile as a clean ✓.
 *
 * Media properties are denormalized directly onto the node (no Property nodes),
 * because `save()` writes them with `setValues({ node: … })`.
 *
 * `mime_type` is NOT NULL here but is only written when the caller supplies a
 * `__typename`, so older rows can lack it. Rather than drop those, fall back to
 * the owning FileVersion's own `mimeType` Property — the same value the upload
 * recorded, and the reason a Media exists at all.
 */

interface RawMedia {
  id: ID;
  type: string | null;
  fileVersionId: ID;
  mimeType: string | null;
  fallbackMimeType: string | null;
  altText: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  createdAt: { toJSDate: () => Date } | null;
}

const READ = `
  MATCH (fv:FileVersion)-[:media]->(m:Media)
  OPTIONAL MATCH (fv)-[:mimeType { active: true }]->(fvMime:Property)
  RETURN m.id AS id,
         m.type AS type,
         fv.id AS fileVersionId,
         m.mimeType AS mimeType,
         fvMime.value AS fallbackMimeType,
         m.altText AS altText,
         m.caption AS caption,
         m.width AS width,
         m.height AS height,
         m.duration AS duration,
         m.createdAt AS createdAt
`;

const MEDIA_TYPES = ['Image', 'Video', 'Audio'] as const;

export const mediaExtractor: Extractor = {
  name: 'media',
  targetTables: ['media'],
  dependsOn: ['file'],
  async run(ctx) {
    await warnIfRelTypeUnknown(ctx, 'media');
    const raw = await cypher<RawMedia>(ctx, READ);
    // What LANDED in file_nodes, not what Neo4j holds: the file extractor drops
    // FileVersions missing mimeType/size, and this is where that fans out.
    const landedFileNodes = await liveTargetIds(ctx, 'FileNode', fileNodes);

    const { kept, skipped } = keepLanded(raw, [
      [landedFileNodes, (row) => row.fileVersionId],
    ]);
    if (skipped > 0) {
      ctx.log(
        `    ⚠ ${skipped} Media row(s) skipped — their FileVersion did not land ` +
          `(dropped by the file extractor, or soft-deleted)`,
      );
    }

    const allowedTypes = new Set<string>(MEDIA_TYPES);
    const typed = kept.filter((row) => allowedTypes.has(row.type ?? ''));
    if (typed.length !== kept.length) {
      const offending = [
        ...new Set(
          kept
            .filter((row) => !allowedTypes.has(row.type ?? ''))
            .map((row) => row.type ?? '(null)'),
        ),
      ];
      ctx.log(
        `    ⚠ ${kept.length - typed.length} Media row(s) carry a type the media_type enum ` +
          `rejects — DROPPED (media.type is NOT NULL). Values seen: ${offending.join(', ')}`,
      );
    }

    const mimeless = typed.filter(
      (row) => (row.mimeType ?? row.fallbackMimeType) == null,
    );
    if (mimeless.length > 0) {
      ctx.log(
        `    ⚠ ${mimeless.length} Media row(s) have no mimeType and their FileVersion has none ` +
          `either — DROPPED; media.mime_type is NOT NULL`,
      );
    }
    const withMime = typed.filter(
      (row) => (row.mimeType ?? row.fallbackMimeType) != null,
    );

    // media_file_version_id_unique: one Media per FileVersion. `save()` MERGEs,
    // so a duplicate should be impossible — keep the newest and say so rather
    // than letting onConflictDoNothing pick arbitrarily.
    const byFileVersion = new Map<ID, RawMedia>();
    let duplicates = 0;
    for (const row of withMime) {
      const held = byFileVersion.get(row.fileVersionId);
      if (!held) {
        byFileVersion.set(row.fileVersionId, row);
        continue;
      }
      duplicates++;
      const heldAt = held.createdAt?.toJSDate().getTime() ?? 0;
      const rowAt = row.createdAt?.toJSDate().getTime() ?? 0;
      if (rowAt > heldAt) byFileVersion.set(row.fileVersionId, row);
    }
    if (duplicates > 0) {
      ctx.log(
        `    ⚠ ${duplicates} FileVersion(s) carry more than one Media — kept the newest ` +
          `(media_file_version_id_unique allows one)`,
      );
    }

    const rows = [...byFileVersion.values()].map((row) => ({
      id: row.id,
      type: row.type as (typeof MEDIA_TYPES)[number],
      fileVersionId: row.fileVersionId,
      mimeType: (row.mimeType ?? row.fallbackMimeType)!,
      altText: row.altText ?? null,
      caption: row.caption ?? null,
      width: row.width ?? null,
      height: row.height ?? null,
      duration: row.duration ?? null,
      createdAt: ts(row.createdAt) ?? new Date(0),
    }));

    const inserted = await bulkInsert(ctx, media, rows);
    // PRE-drop count, so the unlanded-file-version, unknown-type and mimeless
    // drops above show as a read-vs-inserted gap rather than reconciling ✓.
    return one('media', raw.length, inserted);
  },
};
