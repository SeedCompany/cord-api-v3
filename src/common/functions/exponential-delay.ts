import { type DurationIn } from '@seedcompany/common/temporal/luxon';
import { Duration } from 'luxon';

interface ExponentialDelayOptions {
  attempt: number;
  initial?: DurationIn;
  max?: DurationIn;
  jitter?: number;
}

/**
 * Similar to Apollo's unexported function:
 * - jitter is defined as a percentile, instead of forcing 100%
 * - support for our durations
 * - rounding to milliseconds
 */
export const exponentialDelay = ({
  attempt,
  initial = 300,
  max = Infinity,
  jitter = 0,
}: ExponentialDelayOptions) => {
  const initialMs = Duration.from(initial).toMillis();
  const maxMs =
    typeof max === 'number' && !isFinite(max)
      ? max
      : Duration.from(max).toMillis();
  const jitterCoefficient = jitter ? jitter * (2 * Math.random() - 1) + 1 : 1;
  return Math.round(
    jitterCoefficient * Math.min(initialMs * 2 ** (attempt - 1), maxMs),
  );
};

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace exponentialDelay {
  export type Options = ExponentialDelayOptions;
}
