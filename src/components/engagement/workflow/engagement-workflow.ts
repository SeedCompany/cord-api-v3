import { defineContext, defineWorkflow } from '../../workflow/define-workflow';
import { TransitionType as Type } from '../../workflow/dto';
import { EngagementStatus as Status } from '../dto';
import { EngagementWorkflowEvent } from './dto';
import { BackTo, BackToActive } from './transitions/back';
import { EngagementWorkflowContext } from './transitions/context';
import { ProjectStep } from './transitions/project-step';

// This also controls the order shown in the UI.
// Therefore, these should generally flow down.
// "Back" transitions should come before/above "forward" transitions.
export const EngagementWorkflow = defineWorkflow({
  id: '0d0a59f6-c5f0-4c1d-bd5f-7b2814c76812',
  name: 'Engagement',
  states: Status,
  event: EngagementWorkflowEvent,
  context: defineContext<EngagementWorkflowContext>,
})({
  Reject: {
    from: Status.InDevelopment,
    to: Status.Rejected,
    label: 'Reject',
    type: Type.Reject,
    conditions: ProjectStep('Rejected'),
  },
  'End Development': {
    from: Status.InDevelopment,
    to: Status.DidNotDevelop,
    label: 'End Development',
    type: Type.Reject,
    conditions: ProjectStep('DidNotDevelop'),
  },
  'Approve to Active': {
    from: Status.InDevelopment,
    to: Status.Active,
    label: 'Approve',
    type: Type.Approve,
    conditions: ProjectStep('Active'),
  },
  'Discuss Change To Plan': {
    from: [Status.Active, Status.ActiveChangedPlan],
    to: Status.DiscussingChangeToPlan,
    label: 'Discuss Change to Plan',
    type: Type.Neutral,
  },
  'Discuss Suspension': {
    from: [Status.Active, Status.ActiveChangedPlan],
    to: Status.DiscussingSuspension,
    label: 'Discuss Susupension',
    type: Type.Neutral,
  },
  'Discuss Termination': {
    from: [
      Status.Active,
      Status.ActiveChangedPlan,
      Status.DiscussingSuspension,
      Status.Suspended,
      Status.DiscussingReactivation,
    ],
    to: Status.DiscussingTermination,
    label: 'Discuss Termination',
    type: Type.Neutral,
  },
  'Finalize Completion': {
    from: [Status.Active, Status.ActiveChangedPlan],
    to: Status.FinalizingCompletion,
    label: 'Finalize Completion',
    type: Type.Approve,
  },
  'Approve Change to Plan': {
    from: Status.DiscussingChangeToPlan,
    to: Status.ActiveChangedPlan,
    label: 'Approve Change to Plan',
    type: Type.Approve,
  },
  'Will Not Change Plan': {
    from: Status.DiscussingChangeToPlan,
    to: BackToActive,
    label: 'Will Not Change Plan',
    type: Type.Neutral,
  },
  'Discussing Change to Plan -> Discussing Suspension': {
    from: [Status.DiscussingChangeToPlan],
    to: Status.DiscussingSuspension,
    label: 'Discuss Susupension',
    type: Type.Neutral,
  },
  'Approve Suspension': {
    from: Status.DiscussingSuspension,
    to: Status.Suspended,
    label: 'Approve Suspension',
    type: Type.Approve,
  },
  'Will Not Suspend': {
    from: Status.DiscussingSuspension,
    to: BackToActive,
    label: 'Will Not Suspend',
    type: Type.Neutral,
  },
  'Discuss Reactivation': {
    from: Status.Suspended,
    to: Status.DiscussingReactivation,
    label: 'Discuss Reactivation',
    type: Type.Neutral,
  },
  'Approve Reactivation': {
    from: Status.DiscussingReactivation,
    to: Status.ActiveChangedPlan,
    label: 'Approve Reactivation',
    type: Type.Approve,
  },
  'End Termination Discussion': {
    from: Status.DiscussingTermination,
    to: BackTo(
      Status.Active,
      Status.ActiveChangedPlan,
      Status.DiscussingReactivation,
      Status.Suspended,
    ),
    label: 'Will Not Terminate',
    type: Type.Neutral,
  },
  'Approve Termination': {
    from: Status.DiscussingTermination,
    to: Status.Terminated,
    label: 'Approve Termination',
    type: Type.Approve,
  },
  'Not Ready for Completion': {
    from: Status.FinalizingCompletion,
    to: BackToActive,
    label: 'Still Working',
    type: Type.Neutral,
  },
  Complete: {
    from: Status.FinalizingCompletion,
    to: Status.Completed,
    label: 'Complete 🎉',
    type: Type.Approve,
  },
});
