import { Duration } from 'luxon';
import { exponentialDelay } from './exponential-delay';

type DelayConfig = Omit<exponentialDelay.Options, 'attempt'> & {
  attempts?: number;
};

/**
 * Declare a multi-leveled exponential delay.
 * This allows a few attempts really fast, a few more attempts a bit slower and so on
 */
export const leveledExpBackoff = (levels: readonly DelayConfig[]) => {
  const parsedLevels = levels.map((level) => {
    if (!Array.isArray(level)) {
      return {
        ...level,
        initial:
          level.initial != null ? Duration.from(level.initial) : undefined,
      };
    }
    const [attempts, duration, jitter] = level;
    return { attempts, initial: Duration.from(duration), jitter };
  });
  return (attempt: number) => {
    for (const { attempts: numOfAttempts, ...rest } of parsedLevels) {
      if (!numOfAttempts || numOfAttempts <= 0 || attempt <= numOfAttempts) {
        return exponentialDelay({ attempt, ...rest });
      }
      attempt -= numOfAttempts;
    }
    return -1;
  };
};

type Config = DelayConfig;
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace leveledExpBackoff {
  export type DelayConfig = Config;
}
