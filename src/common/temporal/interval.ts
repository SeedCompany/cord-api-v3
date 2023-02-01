import { DateTime, DateTimeUnit, Interval } from 'luxon';
import { Writable as Mutable } from 'type-fest';
import { inspect } from 'util';

/* eslint-disable @typescript-eslint/method-signature-style */
declare module 'luxon/src/interval' {
  interface Interval {
    [inspect.custom](): string;

    /**
     * Expand this interval to the full duration unit given
     */
    expandToFull(unit: DateTimeUnit): Interval;
  }
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Interval {
    export const compare: (
      previous: Interval | null | undefined,
      updated: Interval | null | undefined
    ) => Record<'additions' | 'removals', Interval[]>;

    export function tryFrom(start: DateTime, end: DateTime): Interval;
    export function tryFrom(
      start: DateTime | null | undefined,
      end: DateTime | null | undefined
    ): Interval | null;
  }
}
/* eslint-enable @typescript-eslint/method-signature-style */

Interval.prototype[inspect.custom] = function (this: Interval) {
  const format = (dt: DateTime) =>
    dt.toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS);
  return `[Interval ${format(this.start)} – ${format(this.end)})`;
};

Interval.prototype.expandToFull = function (
  this: Interval,
  unit: DateTimeUnit
) {
  return Interval.fromDateTimes(this.start.startOf(unit), this.end.endOf(unit));
};

const IntervalStatic = Interval as Mutable<typeof Interval>;

IntervalStatic.compare = (
  prev: Interval | null | undefined,
  now: Interval | null | undefined
) => {
  const removals = !prev ? [] : !now ? [prev] : prev.difference(now);
  const additions = !now ? [] : !prev ? [now] : now.difference(prev);
  return { removals, additions };
};

function tryFrom(start: DateTime, end: DateTime): Interval;
function tryFrom(
  start: DateTime | null | undefined,
  end: DateTime | null | undefined
): Interval | null;
function tryFrom(
  start: DateTime | null | undefined,
  end: DateTime | null | undefined
): Interval | null {
  return start && end ? Interval.fromDateTimes(start, end) : null;
}
IntervalStatic.tryFrom = tryFrom;
