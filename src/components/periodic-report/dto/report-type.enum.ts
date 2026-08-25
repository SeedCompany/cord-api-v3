import { type EnumType, makeEnum } from '~/common';

export type ReportType = EnumType<typeof ReportType>;
export const ReportType = makeEnum({
  name: 'ReportType',
  values: ['Financial', 'Progress', 'Narrative', 'GTL'],
});

/**
 * The report types whose parent is an Engagement rather than a Project.
 *
 * `periodic_reports` is a single table over every report kind, and which of its
 * two parent FKs a row uses is decided entirely by `type`. That rule is enforced
 * in the DB by `periodic_reports_parent_shape_chk`; this set is its one
 * app-side counterpart, so a new engagement-parented report type is a one-line
 * change here rather than a hunt through the repository.
 */
export const engagementParentedReportTypes = new Set<ReportType>([
  'Progress',
  'GTL',
]);

export const isEngagementParented = (type: ReportType) =>
  engagementParentedReportTypes.has(type);
