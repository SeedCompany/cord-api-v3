import { type EnumType, makeEnum } from '~/common';

export type ReportType = EnumType<typeof ReportType>;
export const ReportType = makeEnum({
  name: 'ReportType',
  values: ['Financial', 'Progress', 'Narrative', 'GTL'],
});

/**
 * The report types whose parent is an Engagement rather than a Project.
 *
 * `periodic_reports` is one table over every report kind, and which of its two
 * parent FKs a row uses is decided by `type`. The DB enforces that with
 * `periodic_reports_parent_shape_chk`; this is the app-side copy of the same
 * rule, so the repository asks "is this engagement-parented?" instead of
 * naming types one by one.
 */
export type EngagementParentedReportType = Extract<
  ReportType,
  'Progress' | 'GTL'
>;

export const engagementParentedReportTypes: ReadonlySet<ReportType> =
  new Set<ReportType>(['Progress', 'GTL']);

export const isEngagementParented = (
  type: ReportType,
): type is EngagementParentedReportType =>
  engagementParentedReportTypes.has(type);
