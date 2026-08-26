import { Policy, Role } from '../util';

/**
 * Read access to GTL quarterly reports for the roles that already read the
 * Momentum equivalent, plus the Field Partner role — a Global Translation
 * Leader's on-the-ground supervisor holds it, and they need to see the report
 * they are being asked to sign off.
 *
 * Write access and the workflow transitions (including supervisor sign-off,
 * which the FPM may also execute) land with the workflow itself.
 */
@Policy(
  [
    Role.ProjectManager,
    Role.RegionalDirector,
    Role.FieldOperationsDirector,
    Role.FieldPartner,
    Role.Leadership,
  ],
  (r) => [
    // Prayer is Posts, and posts are granted through the parent's edge.
    r.GTLReport.read.children((c) => c.posts.read.create),
    r.GtlGoal.read.create.edit.delete,
    r.GtlGoalProgress.read.create.edit.delete,
    r.GtlReportPracticum.read.create.edit.delete,
    r.GtlReportMedia.read.create.edit.delete,
    // Without these the prose sections resolve `canRead: false` for every
    // non-root user and the UI renders nothing — root only saw them because
    // Administrator bypasses policies.
    r.GtlReportCommunityImpact.read.create.edit.delete,
  ],
)
export class GtlReportsPolicy {}
