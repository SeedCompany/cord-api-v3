import { type ID } from '~/common';
import {
  periodicReports,
  progressSummaries,
  summaryPeriodEnum,
} from '~/core/drizzle/schema';
import {
  bulkInsert,
  cypher,
  fetchIds,
  keepLanded,
  liveTargetIds,
  one,
  orDefault,
  recordReadLoss,
  sanitizeEnum,
} from '../cutover.helpers';
import { type Extractor } from '../cutover.types';

/**
 * ProgressSummary — the planned/actual figures the PnP extractor writes per
 * (progress report, period).
 *
 * The smallest mapping in the harness, and the only one where the source node has
 * no identity of its own: a Neo4j ProgressSummary carries just
 * {period, planned, actual} — no id, no createdAt. It is addressed entirely by its
 * report + period, which is what the target's unique index encodes, and why the
 * target id is a bigserial. Insert order therefore assigns the ids, so the rows
 * are sorted before insert to keep them stable across re-runs.
 */
export const progressSummaryExtractor: Extractor = {
  name: 'progress-summary',
  targetTables: ['progress_summaries'],
  dependsOn: ['periodic-report'],
  async run(ctx) {
    const rows = await cypher<{
      reportId: ID;
      period: string;
      planned: number | null;
      actual: number | null;
    }>(
      ctx,
      `MATCH (report:PeriodicReport)-[:summary { active: true }]->(summary:ProgressSummary)
       RETURN report.id AS reportId, summary.period AS period,
              summary.planned AS planned, summary.actual AS actual`,
    );
    // The report edge is required, so summaries under a soft-deleted report drop
    // out of the match entirely — 3 of 48 locally. Enumerate to say so.
    const allIds = await fetchIds(ctx, 'ProgressSummary');
    recordReadLoss(
      ctx,
      'ProgressSummary',
      allIds.length - rows.length,
      `${rows.length} of ${allIds.length} had a live report, the rest hang off a soft-deleted one`,
    );

    const landedReports = await liveTargetIds(
      ctx,
      'PeriodicReport',
      periodicReports,
    );
    const kept = keepLanded(rows, [[landedReports, (row) => row.reportId]]);
    if (kept.skipped > 0) {
      ctx.log(
        `    ⚠ DROPPED ${kept.skipped} summary row(s) whose report never landed`,
      );
    }

    const seen = new Set<string>();
    const droppedPeriods = new Set<string>();
    const defaulted: string[] = [];
    const values = [...kept.kept]
      // Stable bigserial assignment — see the docblock.
      .sort(
        (a, b) =>
          a.reportId.localeCompare(b.reportId) ||
          a.period.localeCompare(b.period),
      )
      .flatMap((row) => {
        const period = sanitizeEnum([row.period], summaryPeriodEnum.enumValues);
        if (!period.kept[0]) {
          droppedPeriods.add(row.period);
          return [];
        }
        // The unique index would absorb a duplicate silently; skip it here so
        // the count is attributable instead.
        const key = `${row.reportId}::${period.kept[0]}`;
        if (seen.has(key)) return [];
        seen.add(key);
        if (row.planned == null || row.actual == null) {
          defaulted.push(row.reportId);
        }
        return [
          {
            reportId: row.reportId,
            period: period.kept[0],
            planned: orDefault(
              ctx,
              'progress_summaries.planned',
              row.planned,
              0,
            ),
            actual: orDefault(ctx, 'progress_summaries.actual', row.actual, 0),
          },
        ];
      });
    if (droppedPeriods.size > 0) {
      ctx.log(
        `    ⚠ DROPPED summary row(s) naming a period outside the summary_period enum: ` +
          `${[...droppedPeriods].join(', ')} — migration-todo: map, don't drop`,
      );
    }
    if (defaulted.length > 0) {
      ctx.log(
        `    ⚠ ${defaulted.length} summary row(s) had a null planned/actual under NOT NULL columns — ` +
          `zeroed: ${defaulted.slice(0, 10).join(', ')}`,
      );
    }
    if (values.length !== kept.kept.length) {
      ctx.log(
        `    ⚠ skipped ${kept.kept.length - values.length} summary row(s) — unknown period or a ` +
          `(report, period) duplicate`,
      );
    }

    return one(
      'progress_summaries',
      rows.length,
      await bulkInsert(ctx, progressSummaries, values),
    );
  },
};
