import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { SecuredEnum } from '../../../common';

export enum ProjectStep {
  EarlyConversations = 'EarlyConversations',
  PendingConceptApproval = 'PendingConceptApproval',

  PrepForConsultantEndorsement = 'PrepForConsultantEndorsement',
  PendingConsultantEndorsement = 'PendingConsultantEndorsement',
  PrepForGrowthPlanEndorsement = 'PrepForGrowthPlanEndorsement',
  PendingGrowthPlanEndorsement = 'PendingGrowthPlanEndorsement',

  PrepForFinancialEndorsement = 'PrepForFinancialEndorsement',
  PendingFinancialEndorsement = 'PendingFinancialEndorsement',
  FinalizingProposal = 'FinalizingProposal',
  PendingAreaDirectorApproval = 'PendingAreaDirectorApproval',
  PendingRegionalDirectorApproval = 'PendingRegionalDirectorApproval',
  PendingFinanceConfirmation = 'PendingFinanceConfirmation',
  OnHoldFinanceConfirmation = 'OnHoldFinanceConfirmation',

  Active = 'Active',

  Rejected = 'Rejected',
  Suspended = 'Suspended',
  Terminated = 'Terminated',

  DidNotDevelop = 'DidNotDevelop',
  Completed = 'Completed',
}

registerEnumType(ProjectStep, {
  name: 'ProjectStep',
});

@ObjectType({
  description: SecuredEnum.descriptionFor('a project step'),
})
export class SecuredProjectStep extends SecuredEnum(ProjectStep) {}
