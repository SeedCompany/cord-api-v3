import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { SecuredEnum } from '../../../common';

export enum ProjectStep {
  EarlyConversations = 'EarlyConversations',
  PendingConceptApproval = 'PendingConceptApproval',
  PrepForConsultantEndorsement = 'PrepForConsultantEndorsement',
  PendingConsultantEndorsement = 'PendingConsultantEndorsement',
  PrepForFinancialEndorsement = 'PrepForFinancialEndorsement',
  PendingFinancialEndorsement = 'PendingFinancialEndorsement',
  FinalizingProposal = 'FinalizingProposal',
  PendingRegionalDirectorApproval = 'PendingRegionalDirectorApproval',
  PendingZoneDirectorApproval = 'PendingZoneDirectorApproval',
  PendingFinanceConfirmation = 'PendingFinanceConfirmation',
  OnHoldFinanceConfirmation = 'OnHoldFinanceConfirmation',

  DidNotDevelop = 'DidNotDevelop',
  Rejected = 'Rejected',

  Active = 'Active',
  ActiveChangedPlan = 'ActiveChangedPlan',
  DiscussingChangeToPlan = 'DiscussingChangeToPlan',
  PendingChangeToPlanApproval = 'PendingChangeToPlanApproval',
  DiscussingSuspension = 'DiscussingSuspension',
  PendingSuspensionApproval = 'PendingSuspensionApproval',
  Suspended = 'Suspended',
  DiscussingReactivation = 'DiscussingReactivation',
  PendingReactivationApproval = 'PendingReactivationApproval',
  DiscussingTermination = 'DiscussingTermination',
  PendingTerminationApproval = 'PendingTerminationApproval',
  FinalizingCompletion = 'FinalizingCompletion',

  Terminated = 'Terminated',

  Completed = 'Completed',
}

registerEnumType(ProjectStep, {
  name: 'ProjectStep',
});

@ObjectType({
  description: SecuredEnum.descriptionFor('a project step'),
})
export class SecuredProjectStep extends SecuredEnum(ProjectStep) {}
