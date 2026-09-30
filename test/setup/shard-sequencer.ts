import type { Test } from '@jest/test-result';
import DefaultSequencer from '@jest/test-sequencer';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

// Loaded by Jest itself, outside ts-jest, so it runs on Node's built-in type
// stripping: only erasable syntax here (no enums, parameter properties, etc.).

/**
 * Splits `--shard=i/n` by how long each file takes, instead of by a hash of its
 * path.
 *
 * Jest's own split hands every shard the same number of files, but the e2e
 * files are wildly uneven (webhooks alone is minutes, many are ~10s), so the
 * slowest shard decides the wall clock and hash luck decides the slowest
 * shard. Measured against a real run at 4 shards: 9.1 min slowest shard by
 * hash, 7.5 min by duration.
 *
 * The split is a plain greedy bin-pack: slowest file first, each into the
 * currently lightest shard. Every shard computes the SAME full partition from
 * the same file list and keeps only its own bin, so each file lands in exactly
 * one shard no matter how stale the timings are. Stale timings only make the
 * split less even — they can never drop or duplicate a file. CI checks that
 * independently (test/setup/check-e2e-shards.ts).
 *
 * Files missing from the timings (new ones) weigh the median known duration.
 */
// Jest only loads a sequencer from the default export.
// eslint-disable-next-line import/no-default-export
export default class ShardByDurationSequencer extends DefaultSequencer {
  override shard(
    tests: readonly Test[],
    { shardIndex, shardCount }: { shardIndex: number; shardCount: number },
  ) {
    const bins = partition(
      tests.map((test) => ({ test, key: relativeKey(test) })),
      shardCount,
      loadTimings(),
    );
    return bins[shardIndex - 1]!.map(({ test }) => test);
  }
}

export const timingsFile = new URL('../e2e-timings.json', import.meta.url);

function loadTimings(): Record<string, number> {
  try {
    return JSON.parse(readFileSync(timingsFile, 'utf8'));
  } catch {
    // No timings is still a valid, complete split — just an unweighted one.
    return {};
  }
}

const relativeKey = (test: Test) =>
  relative(test.context.config.rootDir, test.path).split('\\').join('/');

export function partition<T extends { key: string }>(
  items: readonly T[],
  count: number,
  timings: Readonly<Record<string, number>>,
): T[][] {
  const known = Object.values(timings).sort((a, b) => a - b);
  const fallback = known.length ? known[Math.floor(known.length / 2)]! : 1;
  const weigh = (item: T) => timings[item.key] ?? fallback;

  // Tie-break on the path so every shard sorts identically.
  const ordered = [...items].sort(
    (a, b) => weigh(b) - weigh(a) || (a.key < b.key ? -1 : 1),
  );
  const bins: T[][] = Array.from({ length: count }, () => []);
  const loads = new Array<number>(count).fill(0);
  for (const item of ordered) {
    const lightest = loads.indexOf(Math.min(...loads));
    bins[lightest]!.push(item);
    loads[lightest]! += weigh(item);
  }
  return bins;
}
