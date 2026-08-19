import { type ID } from '~/common';
import {
  fileNodes,
  periodicReports,
  progressReportMedia,
  users,
} from '~/core/drizzle/schema';
import { type MediaCategory } from '../../../components/progress-report/media/media-category.enum';
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
 * ProgressReportMedia — the per-variant media slots on a progress report.
 *
 * Stored as a node whose scalar props sit directly on it (`variant`, `category`),
 * wired by four ACTIVE edges:
 *
 * - `(report:ProgressReport)-[:child]->(node)` — the owning report
 * - `(vg:VariantGroup)-[:child]->(node)` — the variant group, which has no table
 *   of its own; `variant_group_id` is a bare NOT NULL text column, no FK
 * - `(node)-[:fileNode]->(file:File)` — the DefinedFile placeholder, optional
 * - `(node)-[:creator]->(:User)`
 *
 * Read raw rather than through the repository: `ProgressReportMediaRepository`
 * exposes only `list(report, args)` and a featured-media lookup — both are
 * paginated, report-scoped views, so there is no all-rows read to borrow. Its
 * `hydrate()` also resolves the attached `Media` through the file's latest
 * version, which this table does not store.
 *
 * Both parent edges are required matches, mirroring the read path: a media row
 * with no report or no variant group cannot be represented (`report_id` and
 * `variant_group_id` are both NOT NULL), so it drops out here exactly as it would
 * from `list()`.
 *
 * `file_id` deliberately has **no FK** in Postgres (the DefinedFile placeholder is
 * created after this row), which means a stale id here would be invisible to the
 * database and surface as a dangling-reference read bug instead. So it is nulled
 * when the File did not land, rather than carried across.
 */

interface RawReportMedia {
  id: ID;
  reportId: ID<'ProgressReport'>;
  variant: string | null;
  category: string | null;
  variantGroupId: ID<'ProgressReportMediaVariantGroup'>;
  fileId: ID<'File'> | null;
  creatorId: ID<'User'>;
  createdAt: { toJSDate: () => Date } | null;
}

const READ = `
  MATCH (report:ProgressReport)-[:child { active: true }]->(m:ProgressReportMedia)
  MATCH (vg:VariantGroup)-[:child { active: true }]->(m)
  MATCH (m)-[:creator { active: true }]->(creator:User)
  OPTIONAL MATCH (m)-[:fileNode { active: true }]->(file:File)
  RETURN m.id AS id,
         report.id AS reportId,
         m.variant AS variant,
         m.category AS category,
         vg.id AS variantGroupId,
         file.id AS fileId,
         creator.id AS creatorId,
         m.createdAt AS createdAt
`;

const CATEGORIES = [
  'Team',
  'WorkInProgress',
  'CommunityEngagement',
  'LifeInCommunity',
  'Events',
  'SceneryLandscape',
  'Other',
] as const;

export const progressReportMediaExtractor: Extractor = {
  name: 'progressReportMedia',
  targetTables: ['progress_report_media'],
  dependsOn: ['user', 'periodic-report', 'file'],
  async run(ctx) {
    await warnIfRelTypeUnknown(ctx, 'fileNode');
    const raw = await cypher<RawReportMedia>(ctx, READ);
    const [reportIds, userIds, landedFileNodes] = await Promise.all([
      liveTargetIds(ctx, 'PeriodicReport', periodicReports),
      liveTargetIds(ctx, 'User', users),
      liveTargetIds(ctx, 'FileNode', fileNodes),
    ]);

    const { kept, skipped } = keepLanded(raw, [
      [reportIds, (row) => row.reportId],
      [userIds, (row) => row.creatorId],
    ]);
    if (skipped > 0) {
      ctx.log(
        `    ⚠ ${skipped} ProgressReportMedia row(s) skipped — report or creator did not land ` +
          `(report_id and creator_id are both NOT NULL with FKs)`,
      );
    }

    const variantless = kept.filter((row) => row.variant == null).length;
    if (variantless > 0) {
      ctx.log(
        `    ⚠ ${variantless} row(s) have no variant — DROPPED (variant is NOT NULL and is half ` +
          `of the (variant_group, variant) unique key)`,
      );
    }
    const withVariant = kept.filter((row) => row.variant != null);

    const allowed = new Set<string>(CATEGORIES);
    const unknownCategories = [
      ...new Set(
        withVariant
          .filter((row) => row.category != null && !allowed.has(row.category))
          .map((row) => row.category!),
      ),
    ];
    if (unknownCategories.length > 0) {
      ctx.log(
        `    ⚠ category value(s) the progress_report_media_category enum rejects — NULLED, not ` +
          `dropped (the column is nullable and the row is still meaningful): ` +
          unknownCategories.join(', '),
      );
    }

    const droppedFileRefs = withVariant.filter(
      (row) => row.fileId != null && !landedFileNodes.has(row.fileId),
    ).length;
    if (droppedFileRefs > 0) {
      ctx.log(
        `    ⚠ ${droppedFileRefs} row(s) point at a File that did not land — file_id NULLED ` +
          `(no FK would have caught this; a stale id reads as a dangling reference)`,
      );
    }

    const rows = withVariant.map((row) => ({
      id: row.id,
      reportId: row.reportId,
      variant: row.variant!,
      category:
        row.category != null && allowed.has(row.category)
          ? (row.category as MediaCategory)
          : null,
      variantGroupId: row.variantGroupId,
      fileId:
        row.fileId != null && landedFileNodes.has(row.fileId)
          ? row.fileId
          : null,
      creatorId: row.creatorId,
      createdAt: ts(row.createdAt) ?? new Date(0),
      deletedAt: null,
    }));

    const inserted = await bulkInsert(ctx, progressReportMedia, rows);
    if (inserted < rows.length) {
      ctx.log(
        `    ⚠ ${rows.length - inserted} row(s) not written — likely a duplicate ` +
          `(variant_group_id, variant) pair, which the partial unique index rejects and ` +
          `Neo4j has no equivalent constraint for`,
      );
    }
    // PRE-drop count, so the variantless / unknown-category / dangling-file-ref
    // drops above show as a read-vs-inserted gap rather than reconciling ✓.
    return one('progress_report_media', raw.length, inserted);
  },
};
