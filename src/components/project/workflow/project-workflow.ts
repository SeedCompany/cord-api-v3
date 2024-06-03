import { defineContext, defineWorkflow } from '../../workflow/define-workflow';
import { TransitionType as Type } from '../../workflow/dto';
import { ProjectStep as Step } from '../dto';
import { ProjectWorkflowEvent } from './dto';
import { ResolveParams } from './transitions/dynamic-step';

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
  'Early Conversations -> Pending Concept Approval': {
    from: Step.EarlyConversations,
    to: Step.PendingConceptApproval,
    label: 'Submit for Concept Approval',
    type: Type.Approve,
  },
});
