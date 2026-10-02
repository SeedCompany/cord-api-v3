import { gtlReportWorkflowEvents } from '~/core/drizzle/schema';
import { defineContext, defineWorkflow } from '../../workflow/define-workflow';
import { TransitionType as Type } from '../../workflow/dto';
import { GtlReportStatus as Status } from '../dto';
import { GtlReportWorkflowEvent } from './dto';
import { NotTheSender } from './transitions/conditions';
import { type ResolveParams } from './transitions/context';

// The object keys are the transition NAMES: they seed the stored transition
// keys and are what policies grant by. Renaming one orphans persisted events
// and breaks the policy that names it.
//
// Key order is also the order shown in the UI, so these flow down the
// workflow, with each "back" transition above the "forward" one it pairs with.

export const GtlReportWorkflow = defineWorkflow({
  id: '92159fbf-7e40-4c2a-a32a-fba82294c05d',
  name: 'GtlReport',
  states: Status,
  event: GtlReportWorkflowEvent,
  eventTransitionColumn: gtlReportWorkflowEvents.transitionKey,
  context: defineContext<ResolveParams>,
})({
  Start: {
    from: Status.NotStarted,
    to: Status.InProgress,
    label: 'Start',
    type: Type.Approve,
  },

  'Send to Supervisor': {
    from: Status.InProgress,
    to: Status.PendingSupervisorSignOff,
    label: 'Send to Supervisor',
    type: Type.Approve,
  },
  Withdraw: {
    from: Status.PendingSupervisorSignOff,
    to: Status.InProgress,
    label: 'Withdraw to Make Changes',
    type: Type.Reject,
  },
  'Sign Off & Submit': {
    from: Status.PendingSupervisorSignOff,
    to: Status.InReview,
    label: 'Sign Off and Submit for Review',
    type: Type.Approve,
    conditions: NotTheSender,
  },

  'Send for Translation': {
    from: [Status.InProgress, Status.InReview],
    to: Status.PendingTranslation,
    label: 'Send for Translation',
    type: Type.Neutral,
  },
  'Ready for Review': {
    from: Status.PendingTranslation,
    to: Status.InReview,
    label: 'Ready for Review',
    type: Type.Approve,
  },

  'Request Changes': {
    from: Status.InReview,
    to: Status.InProgress,
    label: 'Request Changes',
    type: Type.Reject,
  },
  Approve: {
    from: Status.InReview,
    to: Status.Approved,
    label: 'Approve',
    type: Type.Approve,
  },

  Publish: {
    from: Status.Approved,
    to: Status.Published,
    label: 'Publish',
    type: Type.Approve,
  },
});
