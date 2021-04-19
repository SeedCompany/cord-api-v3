import { isNumber } from 'lodash';
import { Duration, DurationInput } from 'luxon';
import { Mutable } from 'type-fest';

declare module 'luxon/src/duration' {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- augmenting static class method
  namespace Duration {
    export const from: (durationish: DurationInput) => Duration;
  }
}
(Duration as Mutable<typeof Duration>).from = function (
  durationish: DurationInput
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
