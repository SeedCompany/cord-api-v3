import { Duration, DurationLike } from 'luxon';
import { Mutable } from 'type-fest';

declare module 'luxon/src/duration' {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- augmenting static class method
  namespace Duration {
    export const from: (duration: DurationLike) => Duration;
  }
}
const D = Duration as Mutable<typeof Duration>;
D.from = Duration.fromDurationLike;

// @ts-expect-error Adding here, which will be called by pg client
Duration.prototype.toPostgres = function (this: Duration) {
  return this.toISO();
};
