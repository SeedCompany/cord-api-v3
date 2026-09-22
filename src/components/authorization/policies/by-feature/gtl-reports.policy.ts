import { member, Policy, Role } from '../util';

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
    r.GTLReport.read,
    // Prayer is Posts on the ENGAGEMENT, not the report — the report is an
    // attribution carried on the post. Granted through the parent's edge, the
    // same shape field-partner.policy.ts uses for LanguageEngagement.
    r.InternshipEngagement.children((c) => c.posts.when(member).create.read),
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
