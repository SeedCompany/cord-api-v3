import { ObjectType } from '@nestjs/graphql';
import { EnumType, makeEnum, SecuredEnum } from '~/common';

export type ProjectStep = EnumType<typeof ProjectStep>;
export const ProjectStep = makeEnum({
  name: 'ProjectStep',
  values: [
    'EarlyConversations',
    'PendingConceptApproval',
    'PrepForConsultantEndorsement',
    'PendingConsultantEndorsement',
    'PrepForFinancialEndorsement',
    'PendingFinancialEndorsement',
    'FinalizingProposal',
    'PendingRegionalDirectorApproval',
    {
      value: 'PendingZoneDirectorApproval',
      label: 'Pending Field Operations Approval',
    },
    'PendingFinanceConfirmation',
    'OnHoldFinanceConfirmation',
    'DidNotDevelop',
    'Rejected',
    'Active',
    'ActiveChangedPlan',
    'DiscussingChangeToPlan',
    'PendingChangeToPlanApproval',
    'PendingChangeToPlanConfirmation',
    'DiscussingSuspension',
    'PendingSuspensionApproval',
    'Suspended',
    'DiscussingReactivation',
    'PendingReactivationApproval',
    'DiscussingTermination',
    'PendingTerminationApproval',
    'FinalizingCompletion',
    'Terminated',
    'Completed',
  ],
});

@ObjectType({
  description: SecuredEnum.descriptionFor('a project step'),
})
export class SecuredProjectStep extends SecuredEnum(ProjectStep) {}
