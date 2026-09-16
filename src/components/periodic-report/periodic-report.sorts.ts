import { type SortMap } from '~/core/drizzle';
import { periodicReports } from '~/core/drizzle/schema';

/**
 * Sortable columns on the `periodic_reports` row itself.
 *
 * Its own module rather than the progress-report repository so that Engagement
 * can read it for `currentProgressReportDue.*` without the two repositories
 * importing each other — the progress-report repository already imports
 * Engagement's filter clauses, so the reverse direction would close a cycle.
 */
export const periodicReportSortColumns = {
  start: periodicReports.start,
  end: periodicReports.end,
  status: periodicReports.status,
  receivedDate: periodicReports.receivedDate,
  narrativeReceivedDate: periodicReports.narrativeReceivedDate,
  skippedReason: periodicReports.skippedReason,
  createdAt: periodicReports.createdAt,
} satisfies SortMap<string>;
