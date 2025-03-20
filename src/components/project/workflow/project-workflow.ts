import { defineContext, defineWorkflow } from '../../workflow/define-workflow';
import { TransitionType as Type } from '../../workflow/dto';
import { ProjectStep as Step } from '../dto';
import { ProjectWorkflowEvent } from './dto';
import {
  IsMomentumInternship,
  IsMultiplication,
  RequireOngoingEngagementsToBeFinalizingCompletion,
} from './transitions/conditions';
import {
  BackTo,
  BackToActive,
  ResolveParams,
} from './transitions/dynamic-step';
import {
  ApprovalFromEarlyConversationsRequiresEngagements,
  ImplicitlyNotifyTeamMembers,
} from './transitions/enhancers';
import { EmailDistro, FinancialApprovers } from './transitions/notifiers';

// This also controls the order shown in the UI.
// Therefore, these should generally flow down.
// "Back" transitions should come before/above "forward" transitions.

const Distros = {
  Projects: EmailDistro('projects@tsco.org'),
  Approval: EmailDistro('project_approval@tsco.org'),
  Extension: EmailDistro('project_extension@tsco.org'),
  Revision: EmailDistro('project_revision@tsco.org'),
  Suspension: EmailDistro('project_suspension@tsco.org'),
  Termination: EmailDistro('project_termination@tsco.org'),
  Closing: EmailDistro('project_closing@tsco.org'),
};

export const ProjectWorkflow = defineWorkflow({
  id: '8297b9a1-b50b-4ec9-9021-a0347424b3ec',
  name: 'Project',
  states: Step,
  event: ProjectWorkflowEvent,
  context: defineContext<ResolveParams>,
  transitionEnhancers: [
    ImplicitlyNotifyTeamMembers, //
    ApprovalFromEarlyConversationsRequiresEngagements,
  ],
})({
  // In Development
  // region
  'Propose Multiplication': {
    from: Step.EarlyConversations,
    to: Step.PendingRegionalDirectorApproval,
    label: 'Submit for Regional Director Approval',
    type: Type.Approve,
    conditions: IsMultiplication,
  },
  'RD Proposes Multiplication & Approves': {
    from: Step.EarlyConversations,
    to: Step.PendingFinanceConfirmation,
    label: 'Submit for Finance Confirmation',
    type: Type.Approve,
    conditions: IsMultiplication,
  },
  'Request Concept Approval': {
    from: Step.EarlyConversations,
    to: Step.PendingConceptApproval,
    label: 'Submit for Concept Approval',
    type: Type.Approve,
    conditions: IsMomentumInternship,
  },
  'End Conversation': {
    from: Step.EarlyConversations,
    to: Step.DidNotDevelop,
    label: 'End Development',
    type: Type.Reject,
  },

  'Approve Concept': {
    from: Step.PendingConceptApproval,
    to: Step.PrepForConsultantEndorsement,
    label: 'Approve Concept',
    type: Type.Approve,
  },
  'Request Concept Changes': {
    from: Step.PendingConceptApproval,
    to: Step.EarlyConversations,
    label: 'Send Back for Corrections',
    type: Type.Reject,
  },
  'Reject Concept': {
    from: Step.PendingConceptApproval,
    to: Step.Rejected,
    label: 'Reject',
    type: Type.Reject,
  },

  'Request Consultant Endorsement': {
    from: Step.PrepForConsultantEndorsement,
    to: Step.PendingConsultantEndorsement,
    label: 'Submit for Consultant Endorsement',
    type: Type.Approve,
  },
  'Re-request Concept Approval': {
    from: [
      Step.PrepForConsultantEndorsement,
      Step.PrepForFinancialEndorsement,
      Step.FinalizingProposal,
    ],
    to: Step.PendingConceptApproval,
    label: 'Resubmit for Concept Approval',
    type: Type.Neutral,
  },
  'End Proposal': {
    from: [
      Step.PrepForConsultantEndorsement,
      Step.PrepForFinancialEndorsement,
      Step.FinalizingProposal,
    ],
    to: Step.DidNotDevelop,
    label: 'End Development',
    type: Type.Reject,
  },

  'Consultant Endorses Proposal': {
    from: Step.PendingConsultantEndorsement,
    to: Step.PrepForFinancialEndorsement,
    label: 'Endorse Plan',
    type: Type.Approve,
  },
  'Consultant Opposes Proposal': {
    from: Step.PendingConsultantEndorsement,
    to: Step.PrepForFinancialEndorsement,
    label: 'Do Not Endorse Plan',
    type: Type.Neutral,
  },

  'Request Financial Endorsement': {
    from: Step.PrepForFinancialEndorsement,
    to: Step.PendingFinancialEndorsement,
    label: 'Submit for Financial Endorsement',
    type: Type.Approve,
    notifiers: [FinancialApprovers],
  },
  'Re-request Consultant Endorsement': {
    from: [Step.PrepForFinancialEndorsement, Step.FinalizingProposal],
    to: Step.PendingConsultantEndorsement,
    label: 'Resubmit for Consultant Endorsement',
    type: Type.Neutral,
  },

  'Finance Endorses Proposal': {
    from: Step.PendingFinancialEndorsement,
    to: Step.FinalizingProposal,
    label: 'Endorse Project Plan',
    type: Type.Approve,
  },
  'Finance Opposes Proposal': {
    from: Step.PendingFinancialEndorsement,
    to: Step.FinalizingProposal,
    label: 'Do Not Endorse Project Plan',
    type: Type.Neutral,
  },

  'Request Proposal Approval': {
    from: Step.FinalizingProposal,
    to: Step.PendingRegionalDirectorApproval,
    label: 'Submit for Approval',
    type: Type.Approve,
  },
  'Re-request Financial Endorsement': {
    from: Step.FinalizingProposal,
    to: Step.PendingFinancialEndorsement,
    label: 'Resubmit for Financial Endorsement',
    type: Type.Neutral,
  },

  'RD Requests Multiplication Concept Changes': {
    from: Step.PendingRegionalDirectorApproval,
    to: Step.EarlyConversations,
    label: 'Send Back for Corrections',
    type: Type.Reject,
    conditions: IsMultiplication,
  },
  'RD Approves Proposal': {
    from: Step.PendingRegionalDirectorApproval,
    to: Step.PendingFinanceConfirmation,
    label: 'Approve Project',
    type: Type.Approve,
    notifiers: [FinancialApprovers],
  },
  'RD Approves Proposal & Defers to Fields Ops': {
    from: Step.PendingRegionalDirectorApproval,
    to: Step.PendingZoneDirectorApproval,
    label: 'Approve for Field Ops Director Review',
    type: Type.Approve,
    conditions: IsMomentumInternship,
  },
  'RD Requests Proposal Changes': {
    from: Step.PendingRegionalDirectorApproval,
    to: Step.FinalizingProposal,
    label: 'Send Back for Corrections',
    type: Type.Reject,
    conditions: IsMomentumInternship,
  },
  'RD Ends Development': {
    from: Step.PendingRegionalDirectorApproval,
    to: Step.DidNotDevelop,
    label: 'End Development',
    type: Type.Reject,
  },
  'RD Rejects Proposal': {
    from: Step.PendingRegionalDirectorApproval,
    to: Step.Rejected,
    label: 'Reject',
    type: Type.Reject,
  },

  'Field Ops Approves Proposal': {
    from: Step.PendingZoneDirectorApproval,
    to: Step.PendingFinanceConfirmation,
    label: 'Approve Project',
    type: Type.Approve,
    notifiers: [FinancialApprovers],
  },
  'Field Ops Requests Proposal Changes': {
    from: Step.PendingZoneDirectorApproval,
    to: Step.FinalizingProposal,
    label: 'Send Back for Corrections',
    type: Type.Reject,
  },
  'Field Ops Rejects Proposal': {
    from: Step.PendingZoneDirectorApproval,
    to: Step.Rejected,
    label: 'Reject',
    type: Type.Reject,
  },

  'Finance Approves Proposal': {
    from: [Step.PendingFinanceConfirmation, Step.OnHoldFinanceConfirmation],
    to: Step.Active,
    label: 'Confirm Project 🎉',
    type: Type.Approve,
    notifiers: [Distros.Approval, Distros.Projects],
  },
  'Finance Requests Multiplication Changes': {
    from: Step.PendingFinanceConfirmation,
    to: Step.PendingRegionalDirectorApproval,
    label: 'Send Back for Corrections',
    type: Type.Reject,
    conditions: IsMultiplication,
  },
  'Finance Ends Development': {
    from: Step.PendingFinanceConfirmation,
    to: Step.DidNotDevelop,
    label: 'End Development',
    type: Type.Reject,
  },
  'Finance Holds for Confirmation': {
    from: Step.PendingFinanceConfirmation,
    to: Step.OnHoldFinanceConfirmation,
    label: 'Hold Project for Confirmation',
    type: Type.Neutral,
    conditions: IsMomentumInternship,
  },
  'Finance Requests Proposal Changes': {
    from: [Step.PendingFinanceConfirmation, Step.OnHoldFinanceConfirmation],
    to: Step.FinalizingProposal,
    label: 'Send Back for Corrections',
    type: Type.Reject,
    conditions: IsMomentumInternship,
  },
  'Finance Rejects Proposal': {
    from: [Step.PendingFinanceConfirmation, Step.OnHoldFinanceConfirmation],
    to: Step.Rejected,
    label: 'Reject',
    type: Type.Reject,
  },
  //endregion

  // Active
  // region
  'Discuss Change To Plan': {
    from: [Step.Active, Step.ActiveChangedPlan],
    to: Step.DiscussingChangeToPlan,
    label: 'Discuss Change to Plan',
    type: Type.Neutral,
    notifiers: [Distros.Extension, Distros.Revision],
  },
  'Discuss Terminating Active Project': {
    from: [Step.Active, Step.ActiveChangedPlan],
    to: Step.DiscussingTermination,
    label: 'Discuss Termination',
    type: Type.Neutral,
    notifiers: [Distros.Extension, Distros.Revision],
  },
  'Finalize Completion': {
    from: [Step.Active, Step.ActiveChangedPlan],
    to: Step.FinalizingCompletion,
    label: 'Finalize Completion',
    type: Type.Approve,
    notifiers: [Distros.Extension, Distros.Revision],
  },

  'Request Change To Plan Approval': {
    from: Step.DiscussingChangeToPlan,
    to: Step.PendingChangeToPlanApproval,
    label: 'Submit for RD Approval',
    type: Type.Approve,
    notifiers: [Distros.Extension, Distros.Revision],
  },
  'Request Change To Plan Finance Confirmation': {
    from: Step.DiscussingChangeToPlan,
    to: Step.PendingChangeToPlanConfirmation,
    label: 'Submit for Finance Confirmation',
    type: Type.Approve,
    notifiers: [Distros.Extension, Distros.Revision],
  },
  'Discuss Suspension out of Change to Plan Discussion': {
    from: Step.DiscussingChangeToPlan,
    to: Step.DiscussingSuspension,
    label: 'Discuss Suspension',
    type: Type.Neutral,
    notifiers: [Distros.Extension, Distros.Revision],
  },
  'End Change To Plan Discussion': {
    from: Step.DiscussingChangeToPlan,
    to: BackToActive,
    label: 'Will Not Change Plan',
    type: Type.Neutral,
    notifiers: [Distros.Extension, Distros.Revision],
  },

  'Retract Change To Plan Approval Request': {
    from: [
      Step.PendingChangeToPlanApproval,
      Step.PendingChangeToPlanConfirmation,
    ],
    to: Step.DiscussingChangeToPlan,
    label: 'Retract Approval Request',
    type: Type.Neutral,
  },

  'Request Changes for Change To Plan': {
    from: Step.PendingChangeToPlanApproval,
    to: Step.DiscussingChangeToPlan,
    label: 'Send Back for Corrections',
    type: Type.Reject,
    notifiers: [Distros.Extension, Distros.Revision],
  },
  'Approve Change To Plan': {
    from: Step.PendingChangeToPlanApproval,
    to: Step.PendingChangeToPlanConfirmation,
    label: 'Approve Change to Plan',
    type: Type.Approve,
    notifiers: [FinancialApprovers, Distros.Extension, Distros.Revision],
  },
  'Reject Change To Plan': {
    from: Step.PendingChangeToPlanApproval,
    to: BackToActive,
    label: 'Reject Change to Plan',
    type: Type.Reject,
    notifiers: [Distros.Extension, Distros.Revision],
  },

  'Finance Requests Changes for Change To Plan': {
    from: Step.PendingChangeToPlanConfirmation,
    to: Step.DiscussingChangeToPlan,
    label: 'Send Back for Corrections',
    type: Type.Reject,
    notifiers: [Distros.Extension, Distros.Revision],
  },
  'Finance Approves Change To Plan': {
    from: Step.PendingChangeToPlanConfirmation,
    to: Step.ActiveChangedPlan,
    label: 'Approve Change to Plan',
    type: Type.Approve,
    notifiers: [Distros.Extension, Distros.Revision],
  },
  'Finance Rejects Change To Plan': {
    from: Step.PendingChangeToPlanConfirmation,
    to: BackToActive,
    label: 'Reject Change to Plan',
    type: Type.Reject,
    notifiers: [Distros.Extension, Distros.Revision],
  },

  'Request Suspension Approval': {
    from: Step.DiscussingSuspension,
    to: Step.PendingSuspensionApproval,
    label: 'Submit for Approval',
    type: Type.Approve,
    notifiers: Distros.Suspension,
  },
  'End Suspension Discussion': {
    from: Step.DiscussingSuspension,
    to: BackToActive,
    label: 'Will Not Suspend',
    type: Type.Neutral,
    notifiers: Distros.Suspension,
  },

  'Request Changes for Suspension': {
    from: Step.PendingSuspensionApproval,
    to: Step.DiscussingSuspension,
    label: 'Send Back for Corrections',
    type: Type.Reject,
    notifiers: Distros.Suspension,
  },
  'Approve Suspension': {
    from: Step.PendingSuspensionApproval,
    to: Step.Suspended,
    label: 'Approve Suspension',
    type: Type.Approve,
    notifiers: Distros.Suspension,
  },
  'Reject Suspension': {
    from: Step.PendingSuspensionApproval,
    to: BackToActive,
    label: 'Reject Suspension',
    type: Type.Reject,
    notifiers: Distros.Suspension,
  },

  'Discuss Reactivation': {
    from: Step.Suspended,
    to: Step.DiscussingReactivation,
    label: 'Discuss Reactivation',
    type: Type.Neutral,
    notifiers: Distros.Suspension,
  },
  'Discuss Terminating Suspended Project': {
    from: [Step.Suspended, Step.DiscussingReactivation],
    to: Step.DiscussingTermination,
    label: 'Discuss Termination',
    type: Type.Neutral,
    notifiers: Distros.Suspension,
  },

  'Request Reactivation Approval': {
    from: Step.DiscussingReactivation,
    to: Step.PendingReactivationApproval,
    label: 'Submit for Approval',
    type: Type.Approve,
    notifiers: Distros.Suspension,
  },

  'Approve Reactivation': {
    from: Step.PendingReactivationApproval,
    to: Step.ActiveChangedPlan,
    label: 'Approve Reactivation',
    type: Type.Approve,
    notifiers: Distros.Suspension,
  },
  'Request Changes for Reactivation': {
    from: Step.PendingReactivationApproval,
    to: Step.DiscussingReactivation,
    label: 'Send Back for Corrections',
    type: Type.Reject,
    notifiers: Distros.Suspension,
  },
  'Discussing Terminating Suspended Project By Reactivation Approver': {
    from: Step.PendingReactivationApproval,
    to: Step.DiscussingTermination,
    label: 'Discuss Termination',
    type: Type.Neutral,
    notifiers: Distros.Suspension,
  },

  'Request Termination Approval': {
    from: Step.DiscussingTermination,
    to: Step.PendingTerminationApproval,
    label: 'Submit for Approval',
    type: Type.Approve,
    notifiers: Distros.Termination,
  },
  'End Termination Discussion': {
    from: Step.DiscussingTermination,
    to: BackTo(
      Step.Active,
      Step.ActiveChangedPlan,
      Step.DiscussingReactivation,
      Step.Suspended,
    ),
    label: 'Will Not Terminate',
    type: Type.Neutral,
    notifiers: Distros.Termination,
  },

  'Approve Termination': {
    from: Step.PendingTerminationApproval,
    to: Step.Terminated,
    label: 'Approve Termination',
    type: Type.Approve,
    notifiers: Distros.Termination,
  },
  'Request Changes for Termination': {
    from: Step.PendingTerminationApproval,
    to: Step.DiscussingTermination,
    label: 'Send Back for Corrections',
    type: Type.Reject,
    notifiers: Distros.Termination,
  },
  'End Termination Discussion By Approver': {
    from: Step.PendingTerminationApproval,
    to: BackTo(
      Step.Active,
      Step.ActiveChangedPlan,
      Step.DiscussingReactivation,
      Step.Suspended,
    ),
    label: 'Will Not Terminate',
    type: Type.Neutral,
    notifiers: Distros.Termination,
  },

  'Not Ready for Completion': {
    from: Step.FinalizingCompletion,
    to: BackToActive,
    label: 'Still Working',
    type: Type.Neutral,
    notifiers: Distros.Closing,
  },
  Complete: {
    from: Step.FinalizingCompletion,
    to: Step.Completed,
    label: 'Complete 🎉',
    type: Type.Approve,
    conditions: RequireOngoingEngagementsToBeFinalizingCompletion,
    notifiers: Distros.Closing,
  },
  // endregion
});
