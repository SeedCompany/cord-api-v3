import { type ID } from '~/common';
import {
  periodicReports,
  progressReportWorkflowEvents,
  users,
} from '~/core/drizzle/schema';
import { type ProgressReportStatus } from '../../../components/progress-report/dto';
import {
  bulkInsert,
  cypher,
  fetchIds,
  keepLanded,
  liveTargetIds,
  one,
  recordReadLoss,
  richText,
  ts,
  warnIfRelTypeUnknown,
} from '../cutover.helpers';
import { type Extractor } from '../cutover.types';

/**
 * Progress report workflow events — the transition history behind every report's
 * status.
 *
 * Without this extractor a report's CURRENT status carries over (it is a column on
 * `periodic_reports`, filled by the periodic-report extractor) while the record of
 * how it got there does not. This is the largest of the four tables by row count,
 * and the loss would be silent: the status field looks right, and only the history
 * panel is empty.
 *
 * Read with raw Cypher rather than through the repository, on purpose. The repo's
 * `matchEvent()` is a required walk up through `:ProgressReport` → `:Engagement` →
 * `:Project` and then applies `filterToReadable()`, so reading through it would
 * silently shed events whose ancestors are soft-deleted AND everything the running
 * session cannot see. An extractor wants every row, and the ancestor filtering is
 * handled below by the landed-parent guard instead — which is the same answer for
 * the right reason.
 *
 * `status`, `transition` and `notes` are baseNodeProps, stored directly on the node
 * (see `recordEvent`'s `createNode(WorkflowEvent, { baseNodeProps: props })`), so
 * they read straight off it with no Property-node walk.
 */
export const progressReportWorkflowEventExtractor: Extractor = {
  name: 'progress-report-workflow-event',
  targetTables: ['progress_report_workflow_events'],
  dependsOn: ['periodic-report', 'user'],
  async run(ctx) {
    const rows = await cypher<{
      id: ID<'ProgressReportWorkflowEvent'>;
      reportId: ID<'ProgressReport'>;
      who: ID<'User'> | null;
      status: string | null;
      transitionKey: string | null;
      notes: unknown;
      at: string | null;
    }>(
      ctx,
      `MATCH (report:ProgressReport)-[:workflowEvent { active: true }]->(node:ProgressReportWorkflowEvent)
       OPTIONAL MATCH (node)-[:who]->(who:User)
       RETURN node.id AS id,
              report.id AS reportId,
              who.id AS who,
              node.status AS status,
              node.transition AS transitionKey,
              node.notes AS notes,
              toString(node.createdAt) AS at`,
    );
    if (rows.length === 0) {
      // A misspelled relationship type returns zero rows and reconciles ✓, so say
      // so out loud rather than reporting a clean empty run.
      await warnIfRelTypeUnknown(ctx, 'workflowEvent');
    }
    // `report:ProgressReport` is a required match, so events whose report was
    // soft-deleted (every label relabelled `Deleted_`) never enter `rows` at all.
    // Dropping them is the live-only policy working as intended; the problem is
    // that they would leave NO trace — unlike the keepLanded drops below, they
    // are gone before `read` counts them, so this table would reconcile ✓ and the
    // footer would claim zero rows lost. Every sibling in this cluster
    // (progress-summary, PVR, post, comment) enumerates and compares for exactly
    // this reason; this one did not.
    const allEventIds = await fetchIds(ctx, 'ProgressReportWorkflowEvent');
    recordReadLoss(
      ctx,
      'ProgressReportWorkflowEvent',
      allEventIds.length - rows.length,
      `${rows.length} of ${allEventIds.length} hang off a live report, ` +
        `the rest are under a soft-deleted one`,
    );

    // Both are real foreign keys, so a row referencing something that never landed
    // cannot be carried. `who` is NOT NULL as well, which makes the actor guard a
    // requirement rather than a choice.
    const landedReports = await liveTargetIds(
      ctx,
      'ProgressReport',
      periodicReports,
    );
    const landedUsers = await liveTargetIds(ctx, 'User', users);

    const actorless = rows.filter((row) => !row.who).length;
    if (actorless > 0) {
      ctx.log(
        `    ⚠ DROPPED ${actorless} workflow event(s) with no \`who\` edge at all ` +
          `(who is NOT NULL). Neo4j's hydrate() requires that edge too, so these ` +
          `events are already invisible in the app today.`,
      );
    }

    const kept = keepLanded(
      rows.filter((row) => row.who),
      [
        [landedReports, (row) => row.reportId],
        [landedUsers, (row) => row.who!],
      ],
    );
    if (kept.skipped > 0) {
      ctx.log(
        `    ⚠ DROPPED ${kept.skipped} workflow event(s) whose report or actor never ` +
          `landed (both are real FKs). A soft-deleted report is the expected cause — ` +
          `the ETL is live-only, so its events go with it.`,
      );
    }

    // Taken from the column itself rather than re-listed here, so this cannot
    // drift from what Postgres will actually accept.
    const allowedStatuses = new Set<string>(
      progressReportWorkflowEvents.status.enumValues,
    );

    const undated: string[] = [];
    const values = kept.kept.flatMap((row) => {
      // `status` is NOT NULL and an enum. An event predating the status property,
      // or carrying a value the enum no longer lists, would abort the entire load
      // on a cast error — drop it and say how many, the posture the other enum
      // columns take.
      if (!row.status || !allowedStatuses.has(row.status)) return [];
      const status = row.status as ProgressReportStatus;
      if (!row.at) undated.push(row.id);
      return [
        {
          id: row.id,
          reportId: row.reportId,
          who: row.who!,
          status,
          // Nullable here: a bypassed or dynamically resolved transition has no key,
          // which is a legitimate state rather than missing data.
          transitionKey: row.transitionKey ?? null,
          notes: richText(row.notes) ?? null,
          at: ts(row.at) ?? new Date(),
        },
      ];
    });

    const droppedStatus = kept.kept.length - values.length;
    if (droppedStatus > 0) {
      ctx.log(
        `    ⚠ DROPPED ${droppedStatus} workflow event(s) whose status is missing or ` +
          `not a value the \`progress_report_status\` enum lists (NOT NULL enum column)`,
      );
    }
    if (undated.length > 0) {
      ctx.log(
        `    ⚠ ${undated.length} workflow event(s) had no createdAt under a NOT NULL ` +
          `column — stamped now(). These will sort last in the history panel.`,
      );
    }

    const inserted = await bulkInsert(
      ctx,
      progressReportWorkflowEvents,
      values,
    );
    return one('progress_report_workflow_events', rows.length, inserted);
  },
};
