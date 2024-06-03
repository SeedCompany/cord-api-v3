import { Role } from '~/common';
import { ConfigService } from '~/core';
import { TransitionNotifier } from '../../../workflow/transitions/notifiers';
import { FinancialApproverRepository } from '../../financial-approver';
import { ProjectMemberRepository } from '../../project-member/project-member.repository';
import { ResolveParams } from './dynamic-step';

type Notifier = TransitionNotifier<ResolveParams>;

export const TeamMembers: Notifier = {
  description: 'The project members',
  async resolve({ project, moduleRef }) {
    return await moduleRef
      .get(ProjectMemberRepository, { strict: false })
      .listAsNotifiers(project.id);
  },
};

export const TeamMembersWithRole = (...roles: Role[]): Notifier => ({
  description: 'The project members',
  async resolve({ project, moduleRef }) {
    return await moduleRef
      .get(ProjectMemberRepository, { strict: false })
      .listAsNotifiers(project.id, roles);
  },
});

export const FinancialApprovers: Notifier = {
  description: 'All financial approvers according to the project type',
  async resolve({ project, moduleRef }) {
    const repo = moduleRef.get(FinancialApproverRepository, { strict: false });
    const approvers = await repo.read(project.type);
    return approvers.map((approver) => approver.user);
  },
};

export const EmailDistros = (...emails: string[]): Notifier => ({
  description: `These email addresses: ${emails.join(', ')}`,
  resolve({ moduleRef }) {
    const config = moduleRef.get(ConfigService, { strict: false });
    if (!config.email.notifyDistributionLists) {
      return [];
    }
    return emails.map((email) => ({ email }));
  },
});
