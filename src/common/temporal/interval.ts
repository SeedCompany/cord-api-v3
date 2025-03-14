import { setInspectOnClass } from '@seedcompany/common';
import { DateTime, DateTimeUnit, Interval } from 'luxon';
import { Writable as Mutable } from 'type-fest';

/* eslint-disable @typescript-eslint/method-signature-style */
declare module 'luxon/src/interval' {
  interface Interval {
    /**
     * Expand this interval to the full duration unit given
     */
    expandToFull(unit: DateTimeUnit): Interval;
  }
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Interval {
    export const compare: (
      previous: Interval | null | undefined,
      updated: Interval | null | undefined,
    ) => Record<'additions' | 'removals', Interval[]>;

    export function tryFrom(start: DateTime, end: DateTime): Interval;
    export function tryFrom(
      start: DateTime | null | undefined,
      end: DateTime | null | undefined,
    ): Interval | null;
  }
}
/* eslint-enable @typescript-eslint/method-signature-style */

setInspectOnClass(Interval, (i: Interval) => ({ stylize }) => {
  return (
    stylize(`[Interval `, 'special') +
    `${format(i.start)} – ${format(i.end)}` +
    stylize(`)`, 'special')
  );
});
const format = (dt: DateTime) =>
  dt.toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS);

Object.defineProperty(Interval.prototype, 'expandToFull', {
  configurable: true,
  value: function expandToFull(this: Interval, unit: DateTimeUnit) {
    return Interval.fromDateTimes(
      this.start.startOf(unit),
      this.end.endOf(unit),
    );
  },
});

const IntervalStatic = new Proxy(Interval, {
  set(target, p, value) {
    Object.defineProperty(target, p, { value, configurable: true });
    return true;
  },
}) as Mutable<typeof Interval>;

IntervalStatic.compare = function compare(
  prev: Interval | null | undefined,
  now: Interval | null | undefined,
) {
  const removals = !prev ? [] : !now ? [prev] : prev.difference(now);
  const additions = !now ? [] : !prev ? [now] : now.difference(prev);
  return { removals, additions };
};

function tryFrom(start: DateTime, end: DateTime): Interval;
function tryFrom(
  start: DateTime | null | undefined,
  end: DateTime | null | undefined,
): Interval | null;
function tryFrom(
  start: DateTime | null | undefined,
  end: DateTime | null | undefined,
): Interval | null {
  return start && end ? Interval.fromDateTimes(start, end) : null;
}
IntervalStatic.tryFrom = tryFrom;
