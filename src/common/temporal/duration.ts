import { isNumber } from 'lodash';
import { Duration, DurationLike } from 'luxon';
import { Mutable } from 'type-fest';

declare module 'luxon/src/duration' {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- augmenting static class method
  namespace Duration {
    export const from: (durationish: DurationLike) => Duration;
  }
}
(Duration as Mutable<typeof Duration>).from = function (
  durationish: DurationLike
) {
  if (isNumber(durationish)) {
    return Duration.fromMillis(durationish);
  } else if (Duration.isDuration(durationish)) {
    return durationish;
  } else if (typeof durationish === 'object') {
    return Duration.fromObject(durationish);
  } else {
    const _: never = durationish;
    throw new Error();
  }
};

// @ts-expect-error Adding here, which will be called by pg client
Duration.prototype.toPostgres = function (this: Duration) {
  return this.toISO();
};
