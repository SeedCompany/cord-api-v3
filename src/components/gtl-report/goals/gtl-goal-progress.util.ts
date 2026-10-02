import { CalendarDate } from '~/common';
import {
  type GtlGoalMeasurement,
  type GtlGoalScheduleStatus,
  type GtlGoalStatus,
} from '../dto/gtl-goal.enums';

/**
 * How complete a goal is, 0-100, according to how it is measured.
 *
 * Boolean has no progress value of its own — being Done IS its completion.
 * Number and Percent both clamp, so a target that was overshot reads as 100
 * rather than as an impossible number.
 */
export const goalPercentComplete = (goal: {
  measurement: GtlGoalMeasurement;
  status: GtlGoalStatus;
  progressValue: number | null;
  targetNumber: number | null;
}): number => {
  if (goal.status === 'Done') return 100;
  const clamp = (value: number) =>
    Math.min(100, Math.max(0, Math.round(value)));
  switch (goal.measurement) {
    case 'Boolean':
      return 0;
    case 'Percent':
      return clamp(goal.progressValue ?? 0);
    case 'Number':
      return goal.targetNumber
        ? clamp(((goal.progressValue ?? 0) / goal.targetNumber) * 100)
        : 0;
  }
};

/**
 * Whether a goal is tracking against its target date.
 *
 * Null without a target date — there is nothing to be ahead or behind of — and
 * null when cancelled, where the question stops meaning anything.
 *
 * A Done goal is judged by WHEN it was done (`doneOn`, the date of the entry
 * that marked it Done), not by today: a goal finished early stays Ahead no
 * matter how long ago its target date passed. Everything else is judged
 * against today, since it is still open.
 */
export const goalScheduleStatus = (goal: {
  status: GtlGoalStatus;
  targetDate: string | null;
  doneOn: string | null;
}): GtlGoalScheduleStatus | null => {
  if (!goal.targetDate || goal.status === 'Cancelled') return null;
  const target = CalendarDate.fromISO(goal.targetDate);
  if (goal.status === 'Done') {
    const doneOn = goal.doneOn
      ? CalendarDate.fromISO(goal.doneOn)
      : CalendarDate.local();
    return doneOn <= target ? 'Ahead' : 'Behind';
  }
  return CalendarDate.local() > target ? 'Behind' : 'OnTime';
};
