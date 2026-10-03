import { Role } from '~/common';
import { ProjectMemberRepository } from '../../../project/project-member/project-member.repository';
import { type TransitionNotifier } from '../../../workflow/transitions/notifiers';
import { GtlReportWorkflowRepository } from '../gtl-report-workflow.repository';
import { type ResolveParams } from './context';

type Notifier = TransitionNotifier<ResolveParams>;

/**
 * Active members of the report's project holding one of these roles.
 *
 * Membership, not the global role: a Regional Director or Field Operations
 * Director who oversees the project without being on it is not emailed. The
 * same rule the Progress Report applies.
 */
export const TeamMembersWithRole = (...roles: Role[]): Notifier => ({
  description: `Project members with one of these roles: ${roles
    .map((role) => Role.entry(role).label)
    .join(', ')}`,
  async resolve({ report, moduleRef }) {
    const { projectId } = await moduleRef
      .get(GtlReportWorkflowRepository, { strict: false })
      .getNotificationInfo(report.id);
    return await moduleRef
      .get(ProjectMemberRepository, { strict: false })
      .listAsNotifiers(projectId, roles);
  },
});

/**
 * The leader the report is about — the engagement's intern.
 *
 * Named directly rather than through membership because an intern is not
 * automatically a member of the project; `TeamMembersWithRole(Role.Intern)`
 * would miss them. A soft-deleted leader has no email and is skipped.
 */
export const Leader: Notifier = {
  description: "The engagement's leader (intern)",
  async resolve({ report, moduleRef }) {
    const { internId, internEmail } = await moduleRef
      .get(GtlReportWorkflowRepository, { strict: false })
      .getNotificationInfo(report.id);
    return internId ? [{ id: internId, email: internEmail }] : [];
  },
};
