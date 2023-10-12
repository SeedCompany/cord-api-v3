import { Field, ObjectType } from '@nestjs/graphql';
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
    'PendingZoneDirectorApproval',
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

export type TransitionType = EnumType<typeof TransitionType>;
export const TransitionType = makeEnum({
  name: 'TransitionType',
  values: ['Neutral', 'Approve', 'Reject'],
});

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
