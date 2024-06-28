import { defineContext, defineWorkflow } from '../../workflow/define-workflow';
import { TransitionType as Type } from '../../workflow/dto';
import { EngagementStatus as Step } from '../dto';
import { EngagementWorkflowEvent } from './dto';
import {
  BackTo,
  BackToActive,
  ResolveEngagementParams,
} from './transitions/dynamic-step';

// This also controls the order shown in the UI.
// Therefore, these should generally flow down.
// "Back" transitions should come before/above "forward" transitions.
export const EngagementWorkflow = defineWorkflow({
  id: '01903b47-c5fe-7e4b-a1a0-72638ca64760',
  name: 'Engagement',
  states: Step,
  event: EngagementWorkflowEvent,
  context: defineContext<ResolveEngagementParams>,
})({
  Reject: {
    from: Step.InDevelopment,
    to: Step.Rejected,
    label: 'Reject',
    type: Type.Reject,
  },
  'End Development': {
    from: Step.InDevelopment,
    to: Step.DidNotDevelop,
    label: 'End Development',
    type: Type.Reject,
  },
  'Approve to Active': {
    from: Step.InDevelopment,
    to: Step.Active,
    label: 'Approve',
    type: Type.Approve,
  },
  'Discuss Change To Plan': {
    from: [Step.Active, Step.ActiveChangedPlan],
    to: Step.DiscussingChangeToPlan,
    label: 'Discuss Change to Plan',
    type: Type.Neutral,
  },
  'Discuss Suspension': {
    from: [Step.Active, Step.ActiveChangedPlan],
    to: Step.DiscussingSuspension,
    label: 'Discuss Susupension',
    type: Type.Neutral,
  },
  'Discuss Termination': {
    from: [
      Step.Active,
      Step.ActiveChangedPlan,
      Step.DiscussingSuspension,
      Step.Suspended,
      Step.DiscussingReactivation,
    ],
    to: Step.DiscussingTermination,
    label: 'Discuss Termination',
    type: Type.Neutral,
  },
  'Finalize Completion': {
    from: [Step.Active, Step.ActiveChangedPlan],
    to: Step.FinalizingCompletion,
    label: 'Finalize Completion',
    type: Type.Approve,
  },
  'Approve Change to Plan': {
    from: Step.DiscussingChangeToPlan,
    to: Step.ActiveChangedPlan,
    label: 'Approve Change to Plan',
    type: Type.Approve,
  },
  'Will Not Change Plan': {
    from: Step.DiscussingChangeToPlan,
    to: BackToActive,
    label: 'Will Not Change Plan',
    type: Type.Neutral,
  },
  'Discussing Change to Plan -> Discussing Suspension': {
    from: [Step.DiscussingChangeToPlan],
    to: Step.DiscussingSuspension,
    label: 'Discuss Susupension',
    type: Type.Neutral,
  },
  'Approve Suspension': {
    from: Step.DiscussingSuspension,
    to: Step.Suspended,
    label: 'Approve Suspension',
    type: Type.Approve,
  },
  'Will Not Suspend': {
    from: Step.DiscussingSuspension,
    to: BackToActive,
    label: 'Will Not Suspend',
    type: Type.Neutral,
  },
  'Discuss Reactivation': {
    from: Step.Suspended,
    to: Step.DiscussingReactivation,
    label: 'Discuss Reactivation',
    type: Type.Neutral,
  },
  'Approve Reactivation': {
    from: Step.DiscussingReactivation,
    to: Step.ActiveChangedPlan,
    label: 'Approve Reactivation',
    type: Type.Approve,
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
  },
  'Approve Termination': {
    from: Step.DiscussingTermination,
    to: Step.Terminated,
    label: 'Approve Termination',
    type: Type.Approve,
  },
  'Not Ready for Completion': {
    from: Step.FinalizingCompletion,
    to: BackToActive,
    label: 'Still Working',
    type: Type.Neutral,
  },
  Complete: {
    from: Step.FinalizingCompletion,
    to: Step.Completed,
    label: 'Complete 🎉',
    type: Type.Approve,
  },
});
