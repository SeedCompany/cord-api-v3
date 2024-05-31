import { TransitionType as Type } from '../../../workflow/dto';
import { defineTransitions } from '../../../workflow/transitions/types';
import { ProjectStep as Step } from '../../dto';
import { TransitionType as Type } from '../dto';
import { ResolveParams } from './dynamic-step';
import { defineTransitions } from './types';

export type TransitionName = keyof typeof Transitions;

// This also controls the order shown in the UI.
// Therefore, these should generally flow down.
// "Back" transitions should come before/above "forward" transitions.

export const Transitions = defineTransitions<Step, ResolveParams>({
  namespaceId: '8297b9a1-b50b-4ec9-9021-a0347424b3ec',
})({
  'Early Conversations -> Pending Concept Approval': {
    from: Step.EarlyConversations,
    to: Step.PendingConceptApproval,
    label: 'Submit for Concept Approval',
    type: Type.Approve,
  },
});
