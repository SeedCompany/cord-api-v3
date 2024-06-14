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
  EmailDistro,
  FinancialApprovers,
  TeamMembers,
} from './transitions/notifiers';

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
  defaultNotifiers: [TeamMembers],
})({
  'Early Conversations -> Pending Regional Director Approval': {
    from: Step.EarlyConversations,
    to: Step.PendingRegionalDirectorApproval,
    label: 'Submit for Regional Director Approval',
    type: Type.Approve,
    conditions: IsMultiplication,
  },
  'Early Conversations -> Pending Finance Confirmation': {
    from: Step.EarlyConversations,
    to: Step.PendingFinanceConfirmation,
    label: 'Submit for Finance Confirmation',
    type: Type.Approve,
    conditions: IsMultiplication,
  },
  'Early Conversations -> Pending Concept Approval': {
    from: Step.EarlyConversations,
    to: Step.PendingConceptApproval,
    label: 'Submit for Concept Approval',
    type: Type.Approve,
    conditions: IsMomentumInternship,
  },
  'Early Conversations -> Did Not Develop': {
    from: Step.EarlyConversations,
    to: Step.DidNotDevelop,
    label: 'End Development',
    type: Type.Reject,
  },

  // Pending Concept Approval
  'Pending Concept Approval -> Prep for Consultant Endorsement': {
    from: Step.PendingConceptApproval,
    to: Step.PrepForConsultantEndorsement,
    label: 'Approve Concept',
    type: Type.Approve,
  },
  'Pending Concept Approval -> Early Conversations': {
    from: Step.PendingConceptApproval,
    to: Step.EarlyConversations,
    label: 'Send Back for Corrections',
    type: Type.Reject,
  },
  'Pending Concept Approval -> Rejected': {
    from: Step.PendingConceptApproval,
    to: Step.Rejected,
    label: 'Reject',
    type: Type.Reject,
  },

  // Prep for Consultant Endorsement
  'Prep for Consultant Endorsement -> Pending Consultant Endorsement': {
    from: Step.PrepForConsultantEndorsement,
    to: Step.PendingConsultantEndorsement,
    label: 'Submit for Consultant Endorsement',
    type: Type.Approve,
  },
  'Prep for Consultant & Financial Endorsement & Finalizing Proposal -> Pending Concept Approval':
    {
      from: [
        Step.PrepForConsultantEndorsement,
        Step.PrepForFinancialEndorsement,
        Step.FinalizingProposal,
      ],
      to: Step.PendingConceptApproval,
      label: 'Resubmit for Concept Approval',
      type: Type.Neutral,
    },
  'Prep for Consultant & Financial Endorsement & Finalizing Proposal -> Did Not Develop':
    {
      from: [
        Step.PrepForConsultantEndorsement,
        Step.PrepForFinancialEndorsement,
        Step.FinalizingProposal,
      ],
      to: Step.DidNotDevelop,
      label: 'End Development',
      type: Type.Reject,
    },

  // Pending Consultant Endorsement
  'Pending Consultant Endorsement -> Prep for Financial Endorsement With Consultant Endorsement':
    {
      from: Step.PendingConsultantEndorsement,
      to: Step.PrepForFinancialEndorsement,
      label: 'Endorse Plan',
      type: Type.Approve,
    },
  'Pending Consultant Endorsement -> Prep for Financial Endorsement Without Consultant Endorsement':
    {
      from: Step.PendingConsultantEndorsement,
      to: Step.PrepForFinancialEndorsement,
      label: 'Do Not Endorse Plan',
      type: Type.Neutral,
    },

  // Prep for Financial Endorsement
  'Prep for Financial Endorsement -> Pending Financial Endorsement': {
    from: Step.PrepForFinancialEndorsement,
    to: Step.PendingFinancialEndorsement,
    label: 'Submit for Financial Endorsement',
    type: Type.Approve,
  },
  'Prep for Financial Endorsement & Finalizing Proposal -> Pending Consultant Endorsement':
    {
      from: [Step.PrepForFinancialEndorsement, Step.FinalizingProposal],
      to: Step.PendingConsultantEndorsement,
      label: 'Resubmit for Consultant Endorsement',
      type: Type.Neutral,
    },

  // Pending Financial Endorsement
  'Pending Financial Endorsement -> Finalizing Proposal With Financial Endorsement':
    {
      from: Step.PendingFinancialEndorsement,
      to: Step.FinalizingProposal,
      label: 'Endorse Project Plan',
      type: Type.Approve,
    },
  'Pending Financial Endorsement -> Finalizing Proposal Without Financial Endorsement':
    {
      from: Step.PendingFinancialEndorsement,
      to: Step.FinalizingProposal,
      label: 'Do Not Endorse Project Plan',
      type: Type.Neutral,
    },

  // Finalizing Proposal
  'Finalizing Proposal -> Pending Regional Director Approval': {
    from: Step.FinalizingProposal,
    to: Step.PendingRegionalDirectorApproval,
    label: 'Submit for Approval',
    type: Type.Approve,
  },
  'Finalizing Proposal -> Pending Financial Endorsement': {
    from: Step.FinalizingProposal,
    to: Step.PendingFinancialEndorsement,
    label: 'Resubmit for Financial Endorsement',
    type: Type.Neutral,
  },

  // Pending Regional Director Approval
  'Pending Regional Director Approval -> Early Conversations': {
    from: Step.PendingRegionalDirectorApproval,
    to: Step.EarlyConversations,
    label: 'Send Back for Corrections',
    type: Type.Reject,
    conditions: IsMultiplication,
  },
  'Pending Regional Director Approval -> Pending Finance Confirmation': {
    from: Step.PendingRegionalDirectorApproval,
    to: Step.PendingFinanceConfirmation,
    label: 'Approve Project',
    type: Type.Approve,
  },
  'Pending Regional Director Approval -> Pending Zone Director Approval': {
    from: Step.PendingRegionalDirectorApproval,
    to: Step.PendingZoneDirectorApproval,
    label: 'Approve for Field Ops Director Review',
    type: Type.Approve,
    conditions: IsMomentumInternship,
  },
  'Pending Regional Director Approval -> Finalizing Proposal': {
    from: Step.PendingRegionalDirectorApproval,
    to: Step.FinalizingProposal,
    label: 'Send Back for Corrections',
    type: Type.Reject,
    conditions: IsMomentumInternship,
  },
  'Pending Regional Director Approval -> Did Not Develop': {
    from: Step.PendingRegionalDirectorApproval,
    to: Step.DidNotDevelop,
    label: 'End Development',
    type: Type.Reject,
  },
  'Pending Regional Director Approval -> Rejected': {
    from: Step.PendingRegionalDirectorApproval,
    to: Step.Rejected,
    label: 'Reject',
    type: Type.Reject,
  },

  // Pending Zone Director Approval
  'Pending Zone Director Approval -> Pending Finance Confirmation': {
    from: Step.PendingZoneDirectorApproval,
    to: Step.PendingFinanceConfirmation,
    label: 'Approve Project',
    type: Type.Approve,
  },
  'Pending Zone Director Approval -> Finalizing Proposal': {
    from: Step.PendingZoneDirectorApproval,
    to: Step.FinalizingProposal,
    label: 'Send Back for Corrections',
    type: Type.Reject,
  },
  'Pending Zone Director Approval -> Rejected': {
    from: Step.PendingZoneDirectorApproval,
    to: Step.Rejected,
    label: 'Reject',
    type: Type.Reject,
  },

  // Pending Finance Confirmation
  'Pending & On Hold Finance Confirmation -> Active': {
    from: [Step.PendingFinanceConfirmation, Step.OnHoldFinanceConfirmation],
    to: Step.Active,
    label: 'Confirm Project 🎉',
    type: Type.Approve,
    notifiers: [FinancialApprovers, Distros.Approval, Distros.Projects],
  },
  'Pending Finance Confirmation -> Pending Regional Director Approval': {
    from: Step.PendingFinanceConfirmation,
    to: Step.PendingRegionalDirectorApproval,
    label: 'Send Back for Corrections',
    type: Type.Reject,
    conditions: IsMultiplication,
    notifiers: [FinancialApprovers],
  },
  'Pending Finance Confirmation -> Did Not Develop': {
    from: Step.PendingFinanceConfirmation,
    to: Step.DidNotDevelop,
    label: 'End Development',
    type: Type.Reject,
    notifiers: [FinancialApprovers],
  },
  'Pending Finance Confirmation -> On Hold Finance Confirmation': {
    from: Step.PendingFinanceConfirmation,
    to: Step.OnHoldFinanceConfirmation,
    label: 'Hold Project for Confirmation',
    type: Type.Neutral,
    conditions: IsMomentumInternship,
    notifiers: [FinancialApprovers],
  },
  'Pending & On Hold Finance Confirmation -> Finalizing Proposal': {
    from: [Step.PendingFinanceConfirmation, Step.OnHoldFinanceConfirmation],
    to: Step.FinalizingProposal,
    label: 'Send Back for Corrections',
    type: Type.Reject,
    conditions: IsMomentumInternship,
    notifiers: [FinancialApprovers],
  },
  'Pending & On Hold Finance Confirmation -> Rejected': {
    from: [Step.PendingFinanceConfirmation, Step.OnHoldFinanceConfirmation],
    to: Step.Rejected,
    label: 'Reject',
    type: Type.Reject,
    notifiers: [FinancialApprovers],
  },

  // Active
  'Active -> Discussing Change To Plan': {
    from: [Step.Active, Step.ActiveChangedPlan],
    to: Step.DiscussingChangeToPlan,
    label: 'Discuss Change to Plan',
    type: Type.Neutral,
    notifiers: [FinancialApprovers, Distros.Extension, Distros.Revision],
  },
  'Active -> Discussing Termination': {
    from: [Step.Active, Step.ActiveChangedPlan],
    to: Step.DiscussingTermination,
    label: 'Discuss Termination',
    type: Type.Neutral,
    notifiers: [FinancialApprovers, Distros.Extension, Distros.Revision],
  },
  'Active -> Finalizing Completion': {
    from: [Step.Active, Step.ActiveChangedPlan],
    to: Step.FinalizingCompletion,
    label: 'Finalize Completion',
    type: Type.Approve,
    notifiers: [FinancialApprovers, Distros.Extension, Distros.Revision],
  },

  // Disucssing Change To Plan
  'Discussing Change To Plan -> Pending Change To Plan Approval': {
    from: Step.DiscussingChangeToPlan,
    to: Step.PendingChangeToPlanApproval,
    label: 'Submit for Approval',
    type: Type.Approve,
    notifiers: [Distros.Extension, Distros.Revision],
  },
  'Discussing Change To Plan -> Discussing Suspension': {
    from: Step.DiscussingChangeToPlan,
    to: Step.DiscussingSuspension,
    label: 'Discuss Suspension',
    type: Type.Neutral,
    notifiers: [Distros.Extension, Distros.Revision],
  },
  'Discussing Change To Plan -> Back To Active': {
    from: Step.DiscussingChangeToPlan,
    to: BackToActive,
    label: 'Will Not Change Plan',
    type: Type.Neutral,
    notifiers: [Distros.Extension, Distros.Revision],
  },

  // Pending Change To Plan Approval
  'Pending Change To Plan Approval -> Discussing Change To Plan': {
    from: Step.PendingChangeToPlanApproval,
    to: Step.DiscussingChangeToPlan,
    label: 'Send Back for Corrections',
    type: Type.Reject,
    notifiers: [Distros.Extension, Distros.Revision],
  },
  'Pending Change To Plan Approval -> Pending Change To Plan Confirmation': {
    from: Step.PendingChangeToPlanApproval,
    to: Step.PendingChangeToPlanConfirmation,
    label: 'Approve Change to Plan',
    type: Type.Approve,
    notifiers: [Distros.Extension, Distros.Revision],
  },
  'Pending Change To Plan Approval -> Back To Active': {
    from: Step.PendingChangeToPlanApproval,
    to: BackToActive,
    label: 'Reject Change to Plan',
    type: Type.Reject,
    notifiers: [Distros.Extension, Distros.Revision],
  },

  // Pending Change To Plan Confirmation
  'Pending Change To Plan Confirmation -> Discussing Change To Plan': {
    from: Step.PendingChangeToPlanConfirmation,
    to: Step.DiscussingChangeToPlan,
    label: 'Send Back for Corrections',
    type: Type.Reject,
    notifiers: [FinancialApprovers, Distros.Extension, Distros.Revision],
  },
  'Pending Change To Plan Confirmation -> Active Changed Plan': {
    from: Step.PendingChangeToPlanConfirmation,
    to: Step.ActiveChangedPlan,
    label: 'Approve Change to Plan',
    type: Type.Approve,
    notifiers: [FinancialApprovers, Distros.Extension, Distros.Revision],
  },
  'Pending Change To Plan Confirmation -> Back To Active': {
    from: Step.PendingChangeToPlanConfirmation,
    to: BackToActive,
    label: 'Reject Change to Plan',
    type: Type.Reject,
    notifiers: [FinancialApprovers, Distros.Extension, Distros.Revision],
  },

  // Discussing Suspension
  'Discussing Suspension -> Pending Suspension Approval': {
    from: Step.DiscussingSuspension,
    to: Step.PendingSuspensionApproval,
    label: 'Submit for Approval',
    type: Type.Neutral,
    notifiers: Distros.Suspension,
  },
  'Discussing Suspension -> Back To Active': {
    from: Step.DiscussingSuspension,
    to: BackToActive,
    label: 'Will Not Suspend',
    type: Type.Neutral,
    notifiers: Distros.Suspension,
  },

  // Pending Suspension Approval
  'Pending Suspension Approval -> Discussing Suspension': {
    from: Step.PendingSuspensionApproval,
    to: Step.DiscussingSuspension,
    label: 'Send Back for Corrections',
    type: Type.Reject,
    notifiers: Distros.Suspension,
  },
  'Pending Suspension Approval -> Suspended': {
    from: Step.PendingSuspensionApproval,
    to: Step.Suspended,
    label: 'Approve Suspension',
    type: Type.Approve,
    notifiers: Distros.Suspension,
  },
  'Pending Suspension Approval -> Back To Active': {
    from: Step.PendingSuspensionApproval,
    to: BackToActive,
    label: 'Reject Suspension',
    type: Type.Reject,
    notifiers: Distros.Suspension,
  },

  // Suspended
  'Suspended -> Discussing Reactivation': {
    from: Step.Suspended,
    to: Step.DiscussingReactivation,
    label: 'Discuss Reactivation',
    type: Type.Neutral,
    notifiers: Distros.Suspension,
  },
  'Suspended & Discussing Reactivation -> Discussing Termination': {
    from: [Step.Suspended, Step.DiscussingReactivation],
    to: Step.DiscussingTermination,
    label: 'Discuss Termination',
    type: Type.Neutral,
    notifiers: Distros.Suspension,
  },

  // Discussing Reactivation
  'Discussing Reactivation -> Pending Reactivation Approval': {
    from: Step.DiscussingReactivation,
    to: Step.PendingReactivationApproval,
    label: 'Submit for Approval',
    type: Type.Approve,
    notifiers: Distros.Suspension,
  },

  // Pending Reactivation Approval
  'Pending Reactivation Approval -> Active Changed Plan': {
    from: Step.PendingReactivationApproval,
    to: Step.ActiveChangedPlan,
    label: 'Approve Reactivation',
    type: Type.Approve,
    notifiers: Distros.Suspension,
  },
  'Pending Reactivation Approval -> Discussing Reactivation': {
    from: Step.PendingReactivationApproval,
    to: Step.DiscussingReactivation,
    label: 'Send Back for Corrections',
    type: Type.Reject,
    notifiers: Distros.Suspension,
  },
  'Pending Reactivation Approval -> Discussing Termination': {
    from: Step.PendingReactivationApproval,
    to: Step.DiscussingTermination,
    label: 'Discuss Termination',
    type: Type.Neutral,
    notifiers: Distros.Suspension,
  },

  // Discussing Termination
  'Discussing Termination -> Pending Termination Approval': {
    from: Step.DiscussingTermination,
    to: Step.PendingTerminationApproval,
    label: 'Submit for Approval',
    type: Type.Approve,
    notifiers: Distros.Termination,
  },
  'Discussing Termination -> Back To Most Recent': {
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

  // Pending Termination Approval
  'Pending Termination Approval -> Terminated': {
    from: Step.PendingTerminationApproval,
    to: Step.Terminated,
    label: 'Approve Termination',
    type: Type.Approve,
    notifiers: Distros.Termination,
  },
  'Pending Termination Approval -> Discussing Termination': {
    from: Step.PendingTerminationApproval,
    to: Step.DiscussingTermination,
    label: 'Send Back for Corrections',
    type: Type.Reject,
    notifiers: Distros.Termination,
  },
  'Pending Termination Approval -> Back To Most Recent': {
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

  // Finalizing Completion
  'Finalizing Completion -> Back To Active': {
    from: Step.FinalizingCompletion,
    to: BackToActive,
    label: 'Still Working',
    type: Type.Neutral,
    notifiers: Distros.Closing,
  },
  'Finalizing Completion -> Completed': {
    from: Step.FinalizingCompletion,
    to: Step.Completed,
    label: 'Complete 🎉',
    type: Type.Approve,
    conditions: RequireOngoingEngagementsToBeFinalizingCompletion,
    notifiers: Distros.Closing,
  },
});
