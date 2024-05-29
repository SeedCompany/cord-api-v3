import { defineContext, defineWorkflow } from '../../workflow/define-workflow';
import { TransitionType as Type } from '../../workflow/dto';
import { ProjectStep as Step } from '../dto';
import { ProjectWorkflowEvent } from './dto';
import {
  IsMultiplication,
  IsNotMultiplication,
  RequireOngoingEngagementsToBeFinalizingCompletion,
} from './transitions/conditions';
import {
  BackTo,
  BackToActive,
  ResolveParams,
} from './transitions/dynamic-step';
import { EmailDistros, FinancialApprovers } from './transitions/notifiers';

// This also controls the order shown in the UI.
// Therefore, these should generally flow down.
// "Back" transitions should come before/above "forward" transitions.

export const ProjectWorkflow = defineWorkflow({
  id: '8297b9a1-b50b-4ec9-9021-a0347424b3ec',
  name: 'Project',
  states: Step,
  event: ProjectWorkflowEvent,
  context: defineContext<ResolveParams>,
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
    conditions: IsNotMultiplication,
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
    conditions: IsNotMultiplication,
  },
  'Pending Concept Approval -> Early Conversations': {
    from: Step.PendingConceptApproval,
    to: Step.EarlyConversations,
    label: 'Send Back for Corrections',
    type: Type.Reject,
    conditions: IsNotMultiplication,
  },
  'Pending Concept Approval -> Rejected': {
    from: Step.PendingConceptApproval,
    to: Step.Rejected,
    label: 'Reject',
    type: Type.Reject,
    conditions: IsNotMultiplication,
  },

  // Prep for Consultant Endorsement
  'Prep for Consultant Endorsement -> Pending Consultant Endorsement': {
    from: Step.PrepForConsultantEndorsement,
    to: Step.PendingConsultantEndorsement,
    label: 'Submit for Consultant Endorsement',
    type: Type.Approve,
    conditions: IsNotMultiplication,
  },
  'Prep for Consultant Endorsement -> Pending Concept Approval': {
    from: Step.PrepForConsultantEndorsement,
    to: Step.PendingConceptApproval,
    label: 'Resubmit for Concept Approval',
    type: Type.Neutral,
    conditions: IsNotMultiplication,
  },
  'Prep for Consultant Endorsement -> Did Not Develop': {
    from: Step.PrepForConsultantEndorsement,
    to: Step.DidNotDevelop,
    label: 'End Development',
    type: Type.Reject,
    conditions: IsNotMultiplication,
  },

  // Pending Consultant Endorsement
  'Pending Consultant Endorsement -> Prep for Financial Endorsement With Consultant Endorsement':
    {
      from: Step.PendingConsultantEndorsement,
      to: Step.PrepForFinancialEndorsement,
      label: 'Endorse Plan',
      type: Type.Approve,
      conditions: IsNotMultiplication,
    },
  'Pending Consultant Endorsement -> Prep for Financial Endorsement Without Consultant Endorsement':
    {
      from: Step.PendingConsultantEndorsement,
      to: Step.PrepForFinancialEndorsement,
      label: 'Do Not Endorse Plan',
      type: Type.Neutral,
      conditions: IsNotMultiplication,
    },

  // Prep for Financial Endorsement
  'Prep for Financial Endorsement -> Pending Financial Endorsement': {
    from: Step.PrepForFinancialEndorsement,
    to: Step.PendingFinancialEndorsement,
    label: 'Submit for Financial Endorsement',
    type: Type.Approve,
    conditions: IsNotMultiplication,
  },
  'Prep for Financial Endorsement -> Pending Consultant Endorsement': {
    from: Step.PrepForFinancialEndorsement,
    to: Step.PendingConsultantEndorsement,
    label: 'Resubmit for Consultant Endorsement',
    type: Type.Neutral,
    conditions: IsNotMultiplication,
  },
  'Prep for Financial Endorsement -> Pending Concept Approval': {
    from: Step.PrepForFinancialEndorsement,
    to: Step.PendingConceptApproval,
    label: 'Resubmit for Concept Approval',
    type: Type.Neutral,
    conditions: IsNotMultiplication,
  },
  'Prep for Financial Endorsement -> Did Not Develop': {
    from: Step.PrepForFinancialEndorsement,
    to: Step.DidNotDevelop,
    label: 'End Development',
    type: Type.Reject,
    conditions: IsNotMultiplication,
  },

  // Pending Financial Endorsement
  'Pending Financial Endorsement -> Finalizing Proposal With Financial Endorsement':
    {
      from: Step.PendingFinancialEndorsement,
      to: Step.FinalizingProposal,
      label: 'Endorse Project Plan',
      type: Type.Approve,
      conditions: IsNotMultiplication,
    },
  'Pending Financial Endorsement -> Finalizing Proposal Without Financial Endorsement':
    {
      from: Step.PendingFinancialEndorsement,
      to: Step.FinalizingProposal,
      label: 'Do Not Endorse Project Plan',
      type: Type.Neutral,
      conditions: IsNotMultiplication,
    },

  // Finalizing Proposal
  'Finalizing Proposal -> Pending Regional Director Approval': {
    from: Step.FinalizingProposal,
    to: Step.PendingRegionalDirectorApproval,
    label: 'Submit for Approval',
    type: Type.Approve,
    conditions: IsNotMultiplication,
  },
  'Finalizing Proposal -> Pending Financial Endorsement': {
    from: Step.FinalizingProposal,
    to: Step.PendingFinancialEndorsement,
    label: 'Resubmit for Financial Endorsement',
    type: Type.Neutral,
    conditions: IsNotMultiplication,
  },
  'Finalizing Proposal -> Pending Consultant Endorsement': {
    from: Step.FinalizingProposal,
    to: Step.PendingConsultantEndorsement,
    label: 'Resubmit for Consultant Endorsement',
    type: Type.Neutral,
    conditions: IsNotMultiplication,
  },
  'Finalizing Proposal -> Pending Concept Approval': {
    from: Step.FinalizingProposal,
    to: Step.PendingConceptApproval,
    label: 'Resubmit for Concept Approval',
    type: Type.Neutral,
    conditions: IsNotMultiplication,
  },
  'Finalizing Proposal -> Did Not Develop': {
    from: Step.FinalizingProposal,
    to: Step.DidNotDevelop,
    label: 'End Development',
    type: Type.Reject,
    conditions: IsNotMultiplication,
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
    label: 'Approve for Zonal Director Review',
    type: Type.Approve,
    conditions: IsNotMultiplication,
  },
  'Pending Regional Director Approval -> Finalizing Proposal': {
    from: Step.PendingRegionalDirectorApproval,
    to: Step.FinalizingProposal,
    label: 'Send Back for Corrections',
    type: Type.Reject,
    conditions: IsNotMultiplication,
  },
  'Pending Regional Director Approval -> Did Not Develop': {
    from: Step.PendingRegionalDirectorApproval,
    to: Step.DidNotDevelop,
    label: 'End Development',
    type: Type.Reject,
    conditions: IsMultiplication,
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
    conditions: IsNotMultiplication,
  },
  'Pending Zone Director Approval -> Finalizing Proposal': {
    from: Step.PendingZoneDirectorApproval,
    to: Step.FinalizingProposal,
    label: 'Send Back for Corrections',
    type: Type.Reject,
    conditions: IsNotMultiplication,
  },
  'Pending Zone Director Approval -> Rejected': {
    from: Step.PendingZoneDirectorApproval,
    to: Step.Rejected,
    label: 'Reject',
    type: Type.Reject,
    conditions: IsNotMultiplication,
  },

  // Pending Finance Confirmation
  'Pending Finance Confirmation -> Active': {
    from: Step.PendingFinanceConfirmation,
    to: Step.Active,
    label: 'Confirm Project 🎉',
    type: Type.Approve,
    notifiers: [
      FinancialApprovers,
      EmailDistros('project_approval@tsco.org', 'projects@tsco.org'),
    ],
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
    conditions: IsMultiplication,
    notifiers: [FinancialApprovers],
  },
  'Pending Finance Confirmation -> On Hold Finance Confirmation': {
    from: Step.PendingFinanceConfirmation,
    to: Step.OnHoldFinanceConfirmation,
    label: 'Hold Project for Confirmation',
    type: Type.Neutral,
    conditions: IsNotMultiplication,
    notifiers: [FinancialApprovers],
  },
  'Pending Finance Confirmation -> Finalizing Proposal': {
    from: Step.PendingFinanceConfirmation,
    to: Step.FinalizingProposal,
    label: 'Send Back for Corrections',
    type: Type.Reject,
    conditions: IsNotMultiplication,
    notifiers: [FinancialApprovers],
  },
  'Pending Finance Confirmation -> Rejected': {
    from: Step.PendingFinanceConfirmation,
    to: Step.Rejected,
    label: 'Reject',
    type: Type.Reject,
    conditions: IsNotMultiplication,
    notifiers: [FinancialApprovers],
  },

  // On Hold Finance Confirmation
  'On Hold Finance Confirmation -> Active': {
    from: Step.OnHoldFinanceConfirmation,
    to: Step.Active,
    label: 'Confirm Project 🎉',
    type: Type.Approve,
    conditions: IsNotMultiplication,
    notifiers: [
      FinancialApprovers,
      EmailDistros('project_approval@tsco.org', 'projects@tsco.org'),
    ],
  },
  'On Hold Finance Confirmation -> Finalizing Proposal': {
    from: Step.OnHoldFinanceConfirmation,
    to: Step.FinalizingProposal,
    label: 'Send Back for Corrections',
    type: Type.Reject,
    conditions: IsNotMultiplication,
    notifiers: [FinancialApprovers],
  },
  'On Hold Finance Confirmation -> Rejected': {
    from: Step.OnHoldFinanceConfirmation,
    to: Step.Rejected,
    label: 'Reject',
    type: Type.Reject,
    conditions: IsNotMultiplication,
    notifiers: [FinancialApprovers],
  },

  // Active
  'Active -> Discussing Change To Plan': {
    from: [Step.Active, Step.ActiveChangedPlan],
    to: Step.DiscussingChangeToPlan,
    label: 'Discuss Change to Plan',
    type: Type.Neutral,
    notifiers: [
      FinancialApprovers,
      EmailDistros('project_extension@tsco.org', 'project_revision@tsco.org'),
    ],
  },
  'Active -> Discussing Termination': {
    from: [Step.Active, Step.ActiveChangedPlan],
    to: Step.DiscussingTermination,
    label: 'Discuss Termination',
    type: Type.Neutral,
    notifiers: [
      FinancialApprovers,
      EmailDistros('project_extension@tsco.org', 'project_revision@tsco.org'),
    ],
  },
  'Active -> Finalizing Completion': {
    from: [Step.Active, Step.ActiveChangedPlan],
    to: Step.FinalizingCompletion,
    label: 'Finalize Completion',
    type: Type.Approve,
    notifiers: [
      FinancialApprovers,
      EmailDistros('project_extension@tsco.org', 'project_revision@tsco.org'),
    ],
  },

  // Disucssing Change To Plan
  'Discussing Change To Plan -> Pending Change To Plan Approval': {
    from: Step.DiscussingChangeToPlan,
    to: Step.PendingChangeToPlanApproval,
    label: 'Submit for Approval',
    type: Type.Approve,
    notifiers: [
      EmailDistros('project_extension@tsco.org', 'project_revision@tsco.org'),
    ],
  },
  'Discussing Change To Plan -> Discussing Suspension': {
    from: Step.DiscussingChangeToPlan,
    to: Step.DiscussingSuspension,
    label: 'Discuss Suspension',
    type: Type.Neutral,
    notifiers: [
      EmailDistros('project_extension@tsco.org', 'project_revision@tsco.org'),
    ],
  },
  'Discussing Change To Plan -> Back To Active': {
    from: Step.DiscussingChangeToPlan,
    to: BackToActive,
    label: 'Will Not Change Plan',
    type: Type.Neutral,
    notifiers: [
      EmailDistros('project_extension@tsco.org', 'project_revision@tsco.org'),
    ],
  },

  // Pending Change To Plan Approval
  'Pending Change To Plan Approval & Confirmation -> Discussing Change To Plan':
    {
      from: [
        Step.PendingChangeToPlanApproval,
        Step.PendingChangeToPlanConfirmation,
      ],
      to: Step.DiscussingChangeToPlan,
      label: 'Send Back for Corrections',
      type: Type.Reject,
      notifiers: [
        FinancialApprovers,
        EmailDistros('project_extension@tsco.org', 'project_revision@tsco.org'),
      ],
    },
  'Pending Change To Plan Approval -> Pending Change To Plan Confirmation': {
    from: Step.PendingChangeToPlanApproval,
    to: Step.PendingChangeToPlanConfirmation,
    label: 'Approve Change to Plan',
    type: Type.Approve,
    notifiers: [
      FinancialApprovers,
      EmailDistros('project_extension@tsco.org', 'project_revision@tsco.org'),
    ],
  },
  'Pending Change To Plan Approval & Confirmation -> Back To Active': {
    from: [
      Step.PendingChangeToPlanApproval,
      Step.PendingChangeToPlanConfirmation,
    ],
    to: BackToActive,
    label: 'Reject Change to Plan',
    type: Type.Reject,
    notifiers: [
      FinancialApprovers,
      EmailDistros('project_extension@tsco.org', 'project_revision@tsco.org'),
    ],
  },

  // Pending Change To Plan Confirmation
  'Pending Change To Plan Confirmation -> Active Changed Plan': {
    from: Step.PendingChangeToPlanConfirmation,
    to: Step.ActiveChangedPlan,
    label: 'Approve Change to Plan',
    type: Type.Approve,
    notifiers: [
      FinancialApprovers,
      EmailDistros('project_extension@tsco.org', 'project_revision@tsco.org'),
    ],
  },

  // Discussing Suspension
  'Discussing Suspension -> Pending Suspension Approval': {
    from: Step.DiscussingSuspension,
    to: Step.PendingSuspensionApproval,
    label: 'Submit for Approval',
    type: Type.Neutral,
    notifiers: EmailDistros('project_suspension@tsco.org'),
  },
  'Discussing Suspension -> Back To Active': {
    from: Step.DiscussingSuspension,
    to: BackToActive,
    label: 'Will Not Suspend',
    type: Type.Neutral,
    notifiers: EmailDistros('project_suspension@tsco.org'),
  },

  // Pending Suspension Approval
  'Pending Suspension Approval -> Discussing Suspension': {
    from: Step.PendingSuspensionApproval,
    to: Step.DiscussingSuspension,
    label: 'Send Back for Corrections',
    type: Type.Reject,
    notifiers: EmailDistros('project_suspension@tsco.org'),
  },
  'Pending Suspension Approval -> Suspended': {
    from: Step.PendingSuspensionApproval,
    to: Step.Suspended,
    label: 'Approve Suspension',
    type: Type.Approve,
    notifiers: EmailDistros('project_suspension@tsco.org'),
  },
  'Pending Suspension Approval -> Back To Active': {
    from: Step.PendingSuspensionApproval,
    to: BackToActive,
    label: 'Reject Suspension',
    type: Type.Reject,
    notifiers: EmailDistros('project_suspension@tsco.org'),
  },

  // Suspended
  'Suspended -> Discussing Reactivation': {
    from: Step.Suspended,
    to: Step.DiscussingReactivation,
    label: 'Discuss Reactivation',
    type: Type.Neutral,
    notifiers: EmailDistros('project_suspension@tsco.org'),
  },
  'Suspended -> Discussing Termination': {
    from: Step.Suspended,
    to: Step.DiscussingTermination,
    label: 'Discuss Termination',
    type: Type.Neutral,
    notifiers: EmailDistros('project_suspension@tsco.org'),
  },

  // Discussing Reactivation
  'Discussing Reactivation -> Pending Reactivation Approval': {
    from: Step.DiscussingReactivation,
    to: Step.PendingReactivationApproval,
    label: 'Submit for Approval',
    type: Type.Approve,
    notifiers: EmailDistros('project_suspension@tsco.org'),
  },
  'Discussing Reactivation -> Discussing Termination': {
    from: Step.DiscussingReactivation,
    to: Step.DiscussingTermination,
    label: 'Discuss Termination',
    type: Type.Neutral,
    notifiers: EmailDistros('project_suspension@tsco.org'),
  },

  // Pending Reactivation Approval
  'Pending Reactivation Approval -> Active Changed Plan': {
    from: Step.PendingReactivationApproval,
    to: Step.ActiveChangedPlan,
    label: 'Approve Reactivation',
    type: Type.Approve,
    notifiers: EmailDistros('project_suspension@tsco.org'),
  },
  'Pending Reactivation Approval -> Discussing Reactivation': {
    from: Step.PendingReactivationApproval,
    to: Step.DiscussingReactivation,
    label: 'Send Back for Corrections',
    type: Type.Reject,
    notifiers: EmailDistros('project_suspension@tsco.org'),
  },
  'Pending Reactivation Approval -> Discussing Termination': {
    from: Step.PendingReactivationApproval,
    to: Step.DiscussingTermination,
    label: 'Discuss Termination',
    type: Type.Neutral,
    notifiers: EmailDistros('project_suspension@tsco.org'),
  },

  // Discussing Termination
  'Discussing Termination -> Pending Termination Approval': {
    from: Step.DiscussingTermination,
    to: Step.PendingTerminationApproval,
    label: 'Submit for Approval',
    type: Type.Approve,
    notifiers: EmailDistros('project_termination@tsco.org'),
  },
  'Discussing Termination & Pending Termination Approval -> Back To Most Recent':
    {
      from: [Step.DiscussingTermination, Step.PendingTerminationApproval],
      to: BackTo(
        Step.Active,
        Step.ActiveChangedPlan,
        Step.DiscussingReactivation,
        Step.Suspended,
      ),
      label: 'Will Not Terminate',
      type: Type.Neutral,
      notifiers: EmailDistros('project_termination@tsco.org'),
    },

  // Pending Termination Approval
  'Pending Termination Approval -> Terminated': {
    from: Step.PendingTerminationApproval,
    to: Step.Terminated,
    label: 'Approve Termination',
    type: Type.Approve,
    notifiers: EmailDistros('project_termination@tsco.org'),
  },
  'Pending Termination Approval -> Discussing Termination': {
    from: Step.PendingTerminationApproval,
    to: Step.DiscussingTermination,
    label: 'Send Back for Corrections',
    type: Type.Reject,
    notifiers: EmailDistros('project_termination@tsco.org'),
  },

  // Finalizing Completion
  'Finalizing Completion -> Back To Active': {
    from: Step.FinalizingCompletion,
    to: BackToActive,
    label: 'Still Working',
    type: Type.Neutral,
    notifiers: EmailDistros('project_closing@tsco.org'),
  },
  'Finalizing Completion -> Completed': {
    from: Step.FinalizingCompletion,
    to: Step.Completed,
    label: 'Complete 🎉',
    type: Type.Approve,
    conditions: RequireOngoingEngagementsToBeFinalizingCompletion,
    notifiers: EmailDistros('project_closing@tsco.org'),
  },
});
