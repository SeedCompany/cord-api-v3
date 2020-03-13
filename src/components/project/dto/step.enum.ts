import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Editable, Readable, Secured, SecuredProperty } from '../../../common';

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
  description: SecuredProperty.descriptionFor('a project step'),
  implements: [Readable, Editable],
})
export abstract class SecuredProjectStep implements Secured<ProjectStep> {
  @Field(() => ProjectStep, { nullable: true })
  readonly value?: ProjectStep;
  @Field()
  readonly canRead: boolean;
  @Field()
  readonly canEdit: boolean;
}
