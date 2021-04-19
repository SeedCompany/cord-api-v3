import { DateTime, Interval } from 'luxon';
import { inspect } from 'util';

declare module 'luxon/src/interval' {
  interface Interval {
    // eslint-disable-next-line @typescript-eslint/method-signature-style
    [inspect.custom](): string;
  }
}

Interval.prototype[inspect.custom] = function (this: Interval) {
  const format = (dt: DateTime) =>
    dt.toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS);
  return `[Interval ${format(this.start)} – ${format(this.end)})`;
};
