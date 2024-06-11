import { Role } from '~/common';
import { ConfigService } from '~/core';
import { TransitionNotifier } from '../../../workflow/transitions/notifiers';
import { FinancialApproverRepository } from '../../financial-approver';
import { ProjectMemberRepository } from '../../project-member/project-member.repository';
import { ResolveParams } from './dynamic-step';

type Notifier = TransitionNotifier<ResolveParams>;

export const TeamMembers: Notifier = {
  description: 'Project members',
  async resolve({ project, moduleRef }) {
    return await moduleRef
      .get(ProjectMemberRepository, { strict: false })
      .listAsNotifiers(project.id);
  },
};

export const TeamMembersWithRole = (...roles: Role[]): Notifier => ({
  description: `Project members with one of these roles: ${roles
    .map((r) => Role.entry(r).label)
    .join(', ')}`,
  async resolve({ project, moduleRef }) {
    return await moduleRef
      .get(ProjectMemberRepository, { strict: false })
      .listAsNotifiers(project.id, roles);
  },
});

export const FinancialApprovers: Notifier = {
  description: 'Financial approvers for the project type',
  async resolve({ project, moduleRef }) {
    const repo = moduleRef.get(FinancialApproverRepository, { strict: false });
    const approvers = await repo.read(project.type);
    return approvers.map((approver) => approver.user);
  },
};

export const EmailDistro = (email: string): Notifier => ({
  description: email,
  resolve({ moduleRef }) {
    const config = moduleRef.get(ConfigService, { strict: false });
    if (!config.email.notifyDistributionLists) {
      return [];
    }
    return { email };
  },
});
