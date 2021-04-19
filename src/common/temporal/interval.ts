import { DateTime, DurationUnit, Interval } from 'luxon';
import { inspect } from 'util';

/* eslint-disable @typescript-eslint/method-signature-style */
declare module 'luxon/src/interval' {
  interface Interval {
    [inspect.custom](): string;

    /**
     * Expand this interval to the full duration unit given
     */
    expandToFull(unit: DurationUnit): Interval;
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
  unit: DurationUnit
) {
  return Interval.fromDateTimes(this.start.startOf(unit), this.end.endOf(unit));
};
