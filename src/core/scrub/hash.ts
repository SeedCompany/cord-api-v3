import { createHash } from 'node:crypto';

/**
 * The two digests every generator in this tool keys on.
 *
 * In one place so that `fake.ts` and `entity-name.ts` seed from the SAME
 * function. Two subtly different hashes would make the registry and the plain
 * generators disagree about what a value maps to, and nothing would notice
 * until a name came out different on the next refresh.
 */

/**
 * 48 bits of the digest — deterministic, and inside the safe integer range.
 * The strategy name is part of the input, so one real value maps to a different
 * fake under each strategy.
 */
export const seedFor = (strategy: string, value: string): number =>
  parseInt(
    createHash('sha256')
      .update(`${strategy}\0${value}`)
      .digest('hex')
      .slice(0, 12),
    16,
  );

/** Stable suffix that makes a generated value unique to its input. */
export const tagOf = (value: string): string =>
  createHash('sha256').update(value).digest('hex').slice(0, 10);
