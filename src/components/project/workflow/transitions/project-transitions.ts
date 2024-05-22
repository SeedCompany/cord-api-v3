import { ProjectStep as Step } from '../../dto';
import { TransitionType as Type } from '../dto';
import { defineTransitions } from './types';

export type TransitionName = keyof typeof Transitions;

// This also controls the order shown in the UI.
// Therefore, these should generally flow down.
// "Back" transitions should come before/above "forward" transitions.

export const Transitions = defineTransitions({
  'Early Conversations -> Pending Concept Approval': {
    from: Step.EarlyConversations,
    to: Step.PendingConceptApproval,
    label: 'Submit for Concept Approval',
    type: Type.Approve,
  },
});
