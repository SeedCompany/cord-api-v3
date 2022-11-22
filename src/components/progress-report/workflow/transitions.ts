import { createHash } from 'crypto';
import { mapValues } from 'lodash';
import { ID, Many, maybeMany, TODO } from '~/common';
import { ProgressReportStatus as Status } from '../dto/progress-report-status.enum';
import {
  ProgressReportWorkflowTransition as PublicTransition,
  TransitionType as Type,
} from './dto/workflow-transition.dto';

export const Transitions = defineTransitions({
  'Draft -> In Review': {
    from: Status.Draft,
    to: Status.InReview,
    label: 'Submit for Review',
    type: Type.Approve,
    notify: 'FPM',
  },
  'Draft -> Pending Translation': {
    from: Status.Draft,
    to: Status.PendingTranslation,
    label: 'Submit for Translation',
    type: Type.Approve,
    notify: ['Next', 'Translator'],
  },

  'Translation Done': {
    from: Status.PendingTranslation,
    to: Status.InReview,
    label: 'Ready for Review',
    type: Type.Approve,
    notify: 'FPM',
  },
  'Translation Reject': {
    from: Status.PendingTranslation,
    to: Status.Draft,
    label: 'Need More Info',
    type: Type.Reject,
    notify: 'FP',
  },
  'Withdraw Review Request': {
    from: Status.PendingTranslation,
    to: Status.Draft,
    label: 'Withdraw Translation to Make Changes',
    type: Type.Reject,
  },

  'In Review -> Needs Translation': {
    from: Status.InReview,
    to: Status.PendingTranslation,
    label: 'Needs Translation',
    type: Type.Neutral,
    notify: 'Translator',
  },
  'Review Reject': {
    from: Status.InReview,
    to: Status.Draft,
    label: 'Request Changes',
    type: Type.Reject,
    notify: 'FP',
  },
  'Review Approve': {
    from: Status.InReview,
    to: Status.Approved,
    label: 'Approve',
    type: Type.Approve,
    notify: 'FP & Marketing',
  },

  Publish: {
    from: Status.Approved,
    to: Status.Published,
    label: 'Publish',
    type: Type.Approve,
    notify: '?',
  },
});

type TransitionInput = Omit<PublicTransition, 'id'> & {
  id?: ID | string;
  from?: Many<Status>;
  notify?: TODO;
};

export type TransitionName = keyof typeof Transitions;

export interface InternalTransition extends PublicTransition {
  id: ID;
  name: TransitionName;
  from?: readonly Status[];
  notify?: TODO;
}

function defineTransitions<Names extends string>(
  obj: Record<Names, TransitionInput>
) {
  return mapValues(
    obj,
    (transition, name): InternalTransition => ({
      name: name as TransitionName,
      ...transition,
      from: maybeMany(transition.from),
      id: (transition.id ?? hashId(name)) as ID,
    })
  );
}

function hashId(name: string) {
  return createHash('shake256', { outputLength: 5 }).update(name).digest('hex');
}
