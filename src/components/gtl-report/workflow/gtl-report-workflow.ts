import { Role } from '~/common';
import { gtlReportWorkflowEvents } from '~/core/drizzle/schema';
import { defineContext, defineWorkflow } from '../../workflow/define-workflow';
import { TransitionType as Type } from '../../workflow/dto';
import { GtlReportStatus as Status } from '../dto';
import { GtlReportWorkflowEvent } from './dto';
import { NotTheSender } from './transitions/conditions';
import { type ResolveParams } from './transitions/context';
import { Leader, TeamMembersWithRole } from './transitions/notifiers';

// The object keys are the transition NAMES: they seed the stored transition
// keys and are what policies grant by. Renaming one orphans persisted events
// and breaks the policy that names it.
//
// Key order is also the order shown in the UI, so these flow down the
// workflow, with each "back" transition above the "forward" one it pairs with.
//
// `notifiers` name who is emailed when the transition runs (the person who ran
// it is always left out). Spelled out per transition rather than "every
// member": a blanket rule would also email Marketing and Consultant members
// on every step of the field side's back-and-forth.

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
    // Nobody: starting a draft is the author's own business.
  },

  'Send to Supervisor': {
    from: Status.InProgress,
    to: Status.PendingSupervisorSignOff,
    label: 'Send to Supervisor',
    type: Type.Approve,
    notifiers: TeamMembersWithRole(Role.FieldPartner, Role.ProjectManager),
  },
  Withdraw: {
    from: Status.PendingSupervisorSignOff,
    to: Status.InProgress,
    label: 'Withdraw to Make Changes',
    type: Type.Reject,
    notifiers: TeamMembersWithRole(Role.FieldPartner, Role.ProjectManager),
  },
  'Sign Off & Submit': {
    from: Status.PendingSupervisorSignOff,
    to: Status.InReview,
    label: 'Sign Off and Submit for Review',
    type: Type.Approve,
    conditions: NotTheSender,
    notifiers: [
      TeamMembersWithRole(
        Role.ProjectManager,
        Role.RegionalDirector,
        Role.FieldOperationsDirector,
      ),
      Leader,
    ],
  },

  'Send for Translation': {
    from: [Status.InProgress, Status.InReview],
    to: Status.PendingTranslation,
    label: 'Send for Translation',
    type: Type.Neutral,
    notifiers: TeamMembersWithRole(
      Role.ProjectManager,
      Role.RegionalDirector,
      Role.FieldOperationsDirector,
    ),
  },
  'Ready for Review': {
    from: Status.PendingTranslation,
    to: Status.InReview,
    label: 'Ready for Review',
    type: Type.Approve,
    notifiers: TeamMembersWithRole(
      Role.ProjectManager,
      Role.RegionalDirector,
      Role.FieldOperationsDirector,
    ),
  },

  'Request Changes': {
    from: Status.InReview,
    to: Status.InProgress,
    label: 'Request Changes',
    type: Type.Reject,
    notifiers: [
      TeamMembersWithRole(Role.FieldPartner, Role.ProjectManager),
      Leader,
    ],
  },
  Approve: {
    from: Status.InReview,
    to: Status.Approved,
    label: 'Approve',
    type: Type.Approve,
    notifiers: TeamMembersWithRole(
      Role.Marketing,
      Role.FieldOperationsDirector,
      Role.ProjectManager,
    ),
  },

  Publish: {
    from: Status.Approved,
    to: Status.Published,
    label: 'Publish',
    type: Type.Approve,
    notifiers: [
      TeamMembersWithRole(
        Role.FieldPartner,
        Role.ProjectManager,
        Role.FieldOperationsDirector,
      ),
      Leader,
    ],
  },
});
