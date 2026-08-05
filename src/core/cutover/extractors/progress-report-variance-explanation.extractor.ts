import { type ID } from '~/common';
import {
  periodicReports,
  progressReportVarianceExplanations,
} from '~/core/drizzle/schema';
import {
  bulkInsert,
  cypher,
  keepLanded,
  liveTargetIds,
  one,
  richText,
  warnIfRelTypeUnknown,
} from '../cutover.helpers';
import { type Extractor } from '../cutover.types';

/**
 * Progress report variance explanations — why a report's progress differs from
 * plan: a set of canned reasons plus free prose.
 *
 * One row per report, and the Postgres table says so structurally: `report_id` IS
 * the primary key, there is no id column of its own, and the Neo4j node's id is
 * deliberately discarded. Neo4j enforces the same thing a different way — the
 * repository `merge`s the `varianceExplanation` relationship, so a report can
 * never accumulate two.
 *
 * Unlike its workflow-event sibling, `reasons` and `comments` are NOT stored on the
 * node. The repository reads them with `matchProps`, meaning each is a separate
 * `Property` node behind an active relationship, so the Cypher below walks to them
 * explicitly. Reading these off the node would return nulls for every row and
 * still reconcile as a clean run.
 *
 * Both properties are optional in Neo4j (`matchProps({ optional: true })`, and the
 * repository substitutes `reasons: []` / `comments: null` when absent), so a row
 * with neither is a real state and is carried as the same empty defaults the
 * Postgres column already declares.
 */
export const progressReportVarianceExplanationExtractor: Extractor = {
  name: 'progress-report-variance-explanation',
  targetTables: ['progress_report_variance_explanations'],
  dependsOn: ['periodic-report'],
  async run(ctx) {
    const rows = await cypher<{
      reportId: ID<'ProgressReport'>;
      reasons: string[] | null;
      comments: unknown;
      createdAt: string | null;
      modifiedAt: string | null;
    }>(
      ctx,
      `MATCH (report:ProgressReport)-[:varianceExplanation { active: true }]->(node:ProgressReportVarianceExplanation)
       OPTIONAL MATCH (node)-[:reasons { active: true }]->(reasons:Property)
       OPTIONAL MATCH (node)-[:comments { active: true }]->(comments:Property)
       RETURN report.id AS reportId,
              reasons.value AS reasons,
              comments.value AS comments,
              toString(node.createdAt) AS createdAt,
              toString(node.modifiedAt) AS modifiedAt`,
    );
    if (rows.length === 0) {
      await warnIfRelTypeUnknown(ctx, 'varianceExplanation');
    }

    const landedReports = await liveTargetIds(
      ctx,
      'ProgressReport',
      periodicReports,
    );
    const kept = keepLanded(rows, [[landedReports, (row) => row.reportId]]);
    if (kept.skipped > 0) {
      ctx.log(
        `    ⚠ DROPPED ${kept.skipped} variance explanation(s) whose report never ` +
          `landed (report_id is both the PK and a real FK). A soft-deleted report is ` +
          `the expected cause — the ETL is live-only.`,
      );
    }

    // The relationship is merged, so two active explanations for one report should
    // be impossible. Guard anyway: `report_id` is the primary key, so a duplicate
    // would abort the load, and deduping here reports it instead of failing. A
    // second active row would also mean the merge invariant has been broken, which
    // is worth knowing on its own.
    const seen = new Set<string>();
    const duplicated: string[] = [];
    const undated: string[] = [];
    const values = kept.kept.flatMap((row) => {
      if (seen.has(row.reportId)) {
        duplicated.push(row.reportId);
        return [];
      }
      seen.add(row.reportId);
      if (!row.createdAt) undated.push(row.reportId);
      const created = row.createdAt ? new Date(row.createdAt) : new Date();
      return [
        {
          reportId: row.reportId,
          // Deliberately kept as text[] rather than an enum: the reason vocabulary
          // carries an explicit deprecated list whose whole purpose is keeping old
          // values readable while blocking them for new writes. So an unrecognised
          // reason here is data to preserve, not data to drop — nothing is filtered.
          reasons: row.reasons ?? [],
          comments: richText(row.comments) ?? null,
          createdAt: created,
          // Neo4j only stamps modifiedAt once a property has been updated. Seeding
          // it from createdAt matches what the other extractors do for the same
          // NOT NULL column, and is truthful: never edited means unchanged since
          // creation.
          updatedAt: row.modifiedAt ? new Date(row.modifiedAt) : created,
        },
      ];
    });
    if (duplicated.length > 0) {
      ctx.log(
        `    ⚠ DROPPED ${duplicated.length} duplicate variance explanation(s) — a ` +
          `report held more than one active explanation, which the merge in ` +
          `ProgressReportVarianceExplanationRepository.update is supposed to prevent. ` +
          `Kept the first of each; investigate the source rows.`,
      );
    }
    if (undated.length > 0) {
      ctx.log(
        `    ⚠ ${undated.length} variance explanation(s) had no createdAt under a NOT ` +
          `NULL column — stamped now()`,
      );
    }

    const inserted = await bulkInsert(
      ctx,
      progressReportVarianceExplanations,
      values,
    );
    return one('progress_report_variance_explanations', rows.length, inserted);
  },
};
