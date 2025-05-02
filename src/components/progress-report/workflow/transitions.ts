import { entries, mapValues } from '@seedcompany/common';
import { EnumType, makeEnum } from '@seedcompany/nest';
import { createHash } from 'crypto';
import { ID, Many, maybeMany, Role } from '~/common';
import { TransitionType as Type } from '../../workflow/dto';
import { ProgressReportStatus as Status } from '../dto';
import { ProgressReportWorkflowTransition as PublicTransition } from './dto/workflow-transition.dto';

// This also controls the order shown in the UI.
// Therefore, these should generally flow down.
// "back transactions" should come before/above "forward transactions".

/**
 * There could be roles that are implicitly always notified.
 * @see {@link import('./handlers/progress-report-workflow-notification.handler')}
 */
export const Transitions = defineTransitions({
  Start: {
    from: Status.NotStarted,
    to: Status.InProgress,
    label: 'Start',
    type: Type.Approve,
  },
  'In Progress -> Pending Translation': {
    from: Status.InProgress,
    to: Status.PendingTranslation,
    label: 'Submit for Translation',
    type: Type.Approve,
  },
  'In Progress -> In Review': {
    from: Status.InProgress,
    to: Status.InReview,
    label: 'Submit for Review',
    type: Type.Approve,
  },

  'Translation Done': {
    from: Status.PendingTranslation,
    to: Status.InReview,
    label: 'Ready for Review',
    type: Type.Approve,
  },
  'Translation Reject': {
    from: Status.PendingTranslation,
    to: Status.InProgress,
    label: 'Need More Info',
    type: Type.Reject,
  },
  'Withdraw Review Request': {
    from: Status.PendingTranslation,
    to: Status.InProgress,
    label: 'Withdraw Translation to Make Changes',
    type: Type.Reject,
  },

  'In Review -> Needs Translation': {
    from: Status.InReview,
    to: Status.PendingTranslation,
    label: 'Needs Translation',
    type: Type.Neutral,
  },
  'Review Reject': {
    from: Status.InReview,
    to: Status.InProgress,
    label: 'Request Changes',
    type: Type.Reject,
  },
  'Review Approve': {
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

type TransitionInput = Omit<PublicTransition, 'id'> & {
  id?: ID | string;
  from?: Many<Status>;
  notify?: {
    /**
     * Notify project members with these roles, e.g. [Role.Marketing]
     */
    membersWithRoles?: readonly Role[];
  };
};

export type TransitionName = EnumType<typeof TransitionName>;
export const TransitionName = makeEnum(entries(Transitions).map(([k]) => k));

export interface InternalTransition extends PublicTransition {
  id: ID;
  name: TransitionName;
  from?: readonly Status[];
  notify?: {
    /**
     * Notify project members with these roles, e.g. [Role.Marketing]
     */
    membersWithRoles?: readonly Role[];
  };
}

function defineTransitions<Names extends string>(
  obj: Record<Names, TransitionInput>,
) {
  return mapValues(
    obj,
    (name, transition): InternalTransition => ({
      name: name as TransitionName,
      ...transition,
      from: maybeMany(transition.from),
      id: (transition.id ?? hashId(name)) as ID,
    }),
  ).asRecord;
}

function hashId(name: string) {
  return createHash('shake256', { outputLength: 5 }).update(name).digest('hex');
}
