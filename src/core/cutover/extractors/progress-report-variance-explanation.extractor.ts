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
  ts,
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
 *
 * ## There is no timestamp anywhere in the source
 *
 * `created_at` / `updated_at` are NOT NULL here, and nothing in Neo4j can fill
 * them. Measured on the production copy 2026-08-20: all 5,729 explanation nodes
 * carry ZERO properties — `keys(node)` is empty, so no `createdAt`, no
 * `modifiedAt`, not even an `id` — and the `varianceExplanation` relationship
 * carries only `active`.
 *
 * So this falls back to the PARENT REPORT's `createdAt`, which every report has
 * (0 of 5,729 are missing it). It is not the moment the explanation was written,
 * but it is a real date, it orders correctly relative to other reports, and it
 * cannot be later than the explanation's own creation.
 *
 * It previously fell back to `new Date()`, which stamped every row in the table
 * with the same load time. That is worse than imprecise: it silently destroyed
 * ordering, and because it applied to 100% of rows there was no surviving signal
 * to notice it by.
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
      reportCreatedAt: string | null;
    }>(
      ctx,
      `MATCH (report:ProgressReport)-[:varianceExplanation { active: true }]->(node:ProgressReportVarianceExplanation)
       OPTIONAL MATCH (node)-[:reasons { active: true }]->(reasons:Property)
       OPTIONAL MATCH (node)-[:comments { active: true }]->(comments:Property)
       RETURN report.id AS reportId,
              reasons.value AS reasons,
              comments.value AS comments,
              toString(node.createdAt) AS createdAt,
              toString(node.modifiedAt) AS modifiedAt,
              toString(report.createdAt) AS reportCreatedAt`,
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
    const borrowedFromReport: string[] = [];
    const stampedNow: string[] = [];
    const values = kept.kept.flatMap((row) => {
      if (seen.has(row.reportId)) {
        duplicated.push(row.reportId);
        return [];
      }
      seen.add(row.reportId);
      if (!row.createdAt) {
        (row.reportCreatedAt ? borrowedFromReport : stampedNow).push(
          row.reportId,
        );
      }
      const created =
        ts(row.createdAt) ?? ts(row.reportCreatedAt) ?? new Date();
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
          updatedAt: ts(row.modifiedAt) ?? created,
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
    if (borrowedFromReport.length > 0) {
      ctx.log(
        `    ℹ ${borrowedFromReport.length} of ${values.length} variance ` +
          `explanation(s) carry no createdAt of their own — the source stores no ` +
          `timestamp for them anywhere, so created_at/updated_at come from the ` +
          `parent report. Expect this to be ALL of them; see the docblock.`,
      );
    }
    if (stampedNow.length > 0) {
      ctx.log(
        `    ⚠ ${stampedNow.length} variance explanation(s) had no createdAt AND ` +
          `their report has none either — stamped now(), which is a load-time date ` +
          `with no meaning. Every report in the 2026-08-20 production copy had one, ` +
          `so a non-zero count here is a new finding worth chasing.`,
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
