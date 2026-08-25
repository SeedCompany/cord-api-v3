import { createHash } from 'crypto';
import { type ID, Role } from '~/common';
import { TransitionType as Type } from '../../workflow/dto/workflow-transition.dto';
import { GtlReportStatus as Status } from '../dto/gtl-report-status.enum';

/**
 * The GTL report state machine.
 *
 * Shaped like Momentum's, with one addition that is the reason GTL has its own
 * status enum at all: `PendingSupervisorSignOff`. The FY27 template ends by
 * sending the report to the leader's on-the-ground supervisor for assessment,
 * and review does not begin until that is done.
 *
 * Per Seth (2026-08-24) the sign-off may be executed by the assigned supervisor
 * — who holds the Field Partner role — OR by the FPM on their behalf, which is
 * why both roles appear on `Supervisor Sign-Off`.
 *
 * Order matters: it drives the order shown in the UI, so backward transitions
 * are listed above forward ones within a state.
 */
export interface GtlTransition {
  readonly id: ID;
  readonly name: string;
  readonly from: readonly Status[];
  readonly to: Status;
  readonly label: string;
  readonly type: Type;
  /** Roles permitted to execute. Administrators bypass this. */
  readonly roles: readonly Role[];
}

const hashId = (name: string) =>
  createHash('shake256', { outputLength: 5 }).update(name).digest('hex') as ID;

const define = (
  obj: Record<string, Omit<GtlTransition, 'id' | 'name'>>,
): Record<string, GtlTransition> =>
  Object.fromEntries(
    Object.entries(obj).map(([name, t]) => [
      name,
      { ...t, name, id: hashId(name) },
    ]),
  );

const fieldSide = [Role.FieldPartner, Role.ProjectManager] as const;
const fieldOps = [
  Role.ProjectManager,
  Role.RegionalDirector,
  Role.FieldOperationsDirector,
] as const;

export const GtlTransitions = define({
  Start: {
    from: [Status.NotStarted],
    to: Status.InProgress,
    label: 'Start',
    type: Type.Approve,
    roles: [...fieldSide],
  },
  'Send to Supervisor': {
    from: [Status.InProgress],
    to: Status.PendingSupervisorSignOff,
    label: 'Send to Supervisor',
    type: Type.Approve,
    roles: [...fieldSide],
  },
  'Supervisor Sign-Off': {
    from: [Status.PendingSupervisorSignOff],
    to: Status.InReview,
    label: 'Sign Off and Submit for Review',
    type: Type.Approve,
    // The supervisor themselves, or the FPM entering it on their behalf.
    roles: [Role.FieldPartner, Role.ProjectManager],
  },
  'Withdraw from Supervisor': {
    from: [Status.PendingSupervisorSignOff],
    to: Status.InProgress,
    label: 'Withdraw to Make Changes',
    type: Type.Reject,
    roles: [...fieldSide],
  },
  'Send for Translation': {
    from: [Status.InProgress, Status.InReview],
    to: Status.PendingTranslation,
    label: 'Send for Translation',
    type: Type.Neutral,
    roles: [...fieldOps],
  },
  'Translation Done': {
    from: [Status.PendingTranslation],
    to: Status.InReview,
    label: 'Ready for Review',
    type: Type.Approve,
    roles: [...fieldOps],
  },
  'Request Changes': {
    from: [Status.InReview],
    to: Status.InProgress,
    label: 'Request Changes',
    type: Type.Reject,
    roles: [...fieldOps],
  },
  Approve: {
    from: [Status.InReview],
    to: Status.Approved,
    label: 'Approve',
    type: Type.Approve,
    roles: [...fieldOps],
  },
  Publish: {
    from: [Status.Approved],
    to: Status.Published,
    label: 'Publish',
    type: Type.Approve,
    roles: [Role.Marketing, Role.FieldOperationsDirector],
  },
});

export const transitionsFrom = (status: Status) =>
  Object.values(GtlTransitions).filter((t) => t.from.includes(status));
