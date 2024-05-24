import { Many } from '@seedcompany/common';
import { MergeExclusive, Promisable } from 'type-fest';
import { ID, Role } from '~/common';
import { ConfigService } from '~/core';
import { FinancialApproverRepository } from '../../financial-approver';
import { ProjectMemberRepository } from '../../project-member/project-member.repository';
import { ResolveParams } from './dynamic-step';

export interface TransitionNotifier {
  description: string;
  resolve: (params: ResolveParams) => Promisable<Many<Notifier>>;
}

export type Notifier = MergeExclusive<
  {
    id: ID<'User'>;
    email?: string | null;
  },
  {
    id?: ID<'User'> | null;
    email: string;
  }
>;

export const TeamMembers: TransitionNotifier = {
  description: 'The project members',
  async resolve({ project, moduleRef }: ResolveParams) {
    return await moduleRef
      .get(ProjectMemberRepository, { strict: false })
      .listAsNotifiers(project.id);
  },
};

export const TeamMembersWithRole = (...roles: Role[]): TransitionNotifier => ({
  description: 'The project members',
  async resolve({ project, moduleRef }: ResolveParams) {
    return await moduleRef
      .get(ProjectMemberRepository, { strict: false })
      .listAsNotifiers(project.id, roles);
  },
});

export const FinancialApprovers: TransitionNotifier = {
  description: 'All financial approvers according to the project type',
  async resolve({ project, moduleRef }: ResolveParams) {
    const repo = moduleRef.get(FinancialApproverRepository);
    const approvers = await repo.read(project.type);
    return approvers.map((approver) => approver.user);
  },
};

export const EmailDistros = (...emails: string[]) => ({
  description: `These email addresses: ${emails.join(', ')}`,
  resolve({ moduleRef }: ResolveParams) {
    const config = moduleRef.get(ConfigService);
    if (!config.email.notifyDistributionLists) {
      return [];
    }
    return emails.map((email) => ({ email }));
  },
});
