import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
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
  PendingChangeToPlanConfirmation = 'PendingChangeToPlanConfirmation',
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

export enum TransitionType {
  Neutral = 'Neutral',
  Approve = 'Approve',
  Reject = 'Reject',
}
registerEnumType(TransitionType, { name: 'TransitionType' });

@ObjectType()
export abstract class ProjectStepTransition {
  @Field(() => ProjectStep)
  to: ProjectStep;

  @Field()
  label: string;

  @Field(() => TransitionType)
  type: TransitionType;

  @Field(() => Boolean, { defaultValue: false })
  disabled?: boolean;

  @Field(() => String, { nullable: true })
  disabledReason?: string;
}
