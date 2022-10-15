import { Duration, DurationLike, DurationLikeObject } from 'luxon';
import { Writable } from 'type-fest';

/**
 * A duration represented as an:
 * - ISO string {@link Duration.fromISO}
 * - Human string {@link Duration.fromHuman}
 * - millisecond number {@link Duration.fromMillis}
 * - object literal {@link Duration.fromObject}
 * - Duration instance
 */
export type DurationIn = string | DurationLike;

declare module 'luxon/src/duration' {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- augmenting static class method
  namespace Duration {
    /**
     * Create from ISO, Human, ms number, std object, or another Duration.
     */
    export const from: (duration: DurationIn) => Duration;
    /**
     * Parse a humanized duration string.
     * @example
     * '1hour 20mins'
     * '27,681 ms'    // numeric separators
     * '2hr -40mins'  // negatives
     * '2e3 secs'     // exponents
     */
    export const fromHuman: (duration: string) => Duration;
  }
}
const D = Duration as Writable<typeof Duration>;
D.from = (input: DurationIn) =>
  typeof input === 'string'
    ? input.startsWith('P')
      ? D.fromISO(input)
      : D.fromHuman(input)
    : D.fromDurationLike(input);

D.fromHuman = function (input: string) {
  // Adapted from https://github.com/jkroso/parse-duration
  const durationRE =
    /(-?(?:\d+\.?\d*|\d*\.?\d+)(?:e[-+]?\d+)?)\s*([\p{L}]*)/giu;
  input = input.replace(/(\d)[,_](\d)/g, '$1$2');
  const result: DurationLikeObject = {};
  input.replace(durationRE, (_, num, unit) => {
    result[normalizedUnit(unit)] = parseFloat(num);
    return '';
  });
  return Duration.fromObject(result);
};
const normalizedUnit = (unit: string): keyof DurationLikeObject => {
  unit = unit.toLowerCase();
  // Handle specially here before plural is removed, conflicting with min/sec.
  if (unit === '' || unit === 'ms') {
    return 'millisecond';
  }
  /* eslint-disable prettier/prettier */
  switch (unit.replace(/s$/, '')) {
    case 'sec': case '': return 'second';
    case 'min': case 'm': return 'minute';
    case 'hr': case 'h': return 'hour';
    case 'd': return 'day';
    case 'wk': case 'w': return 'week';
    case 'yr': case 'y': return 'year';
  }
  /* eslint-enable prettier/prettier */
  // Typecasting here as Duration will do its own validation privately
  return unit as keyof DurationLikeObject;
};

// @ts-expect-error Adding here, which will be called by pg client
Duration.prototype.toPostgres = function (this: Duration) {
  return this.toISO();
};
